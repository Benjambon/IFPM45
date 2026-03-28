import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import 'dotenv/config';
import bcrypt from 'bcrypt'; // 🔒 NOUVEAU : Import de bcrypt
import OpenAI from 'openai';

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// 🚨 CORRECTION CRUCIALE : On initialise l'IA et les sessions du chatbot tout en haut !

const ai = new OpenAI({ apiKey: process.env.API_KEY });
const chatSessions = new Map();

// --- 1. CONNEXION SÉCURISÉE ---
const MONGO_URI = process.env.MONGO_URI;

// ... (Garde tout le reste de ton code MongoDB en dessous, ne touche à rien d'autre !)

if (!MONGO_URI) {
    console.error("❌ ERREUR CRITIQUE : La variable MONGO_URI est vide ou introuvable !");
    process.exit(1);
}

// Connexion standard
mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ Connecté à MongoDB avec succès !"))
    .catch(err => console.error("❌ Erreur de connexion MongoDB :", err));

// --- 2. DÉFINITION DES SCHÉMAS ---

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    nom: String,
    prenom: String,
    pseudo: String,
    dateNaissance: Date,
    genre: String,
    metier: String,
    dateDiplome: Date,
    anneeEtude: String,
    statistiques: { type: Object, default: {} }
}, { versionKey: false });

const User = mongoose.model('User', userSchema);

// 🔄 MISE À JOUR : Le nouveau schéma pour coller parfaitement à ta base MongoDB
const exerciceSchema = new mongoose.Schema({
    path: String,
    consignes: String,
    reponses: String, // Contient l'explication détaillée du calcul
    proposition: [String],
    proposition_correct: String, // La réponse courte attendue
    difficulte: String, // C'est maintenant un String ("Difficile") et plus un Number
    categories: [String]
}, { versionKey: false });

const Exercice = mongoose.model('Exercice', exerciceSchema, 'Exercices');

// --- LE NOUVEAU SCHÉMA PROFILAGE ---
const profilageSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Le vrai ID de l'utilisateur !
    anneeEtude: String,
    statistiques_globales: Object,
    embedding_utilisateur: [Number],
    performances_par_categorie: [Object]
}, { collection: 'Profilage', versionKey: false });

const Profilage = mongoose.model('Profilage', profilageSchema);

// --- 3. LES ROUTES ---

app.post('/api/register', async (req, res) => {
    try {
        const existingUser = await User.findOne({ email: req.body.email });
        if (existingUser) {
            return res.status(400).json({ error: "Cet email est déjà utilisé par un autre compte." });
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(req.body.password, saltRounds);
        const userData = { ...req.body, password: hashedPassword };

        const newUser = new User(userData);
        await newUser.save();

        // 🚨 NOUVEAU : Création du Profilage vierge avec ton nouveau format JSON
        const newProfilage = new Profilage({
            user_id: newUser._id,
            anneeEtude: newUser.anneeEtude || "1",
            statistiques_globales: {
                total_questions_rencontrees: 0,
                taux_reussite_global: 0,
                temps_moyen_global_sec: 0,
                score_elo: 1000,
                derniere_activite: new Date()
            },
            embedding_utilisateur: [],
            performances_par_categorie: [] // Se remplira au fur et à mesure qu'il jouera
        });
        await newProfilage.save();

        // 🚨 NOUVEAU : On renvoie l'utilisateur créé (sans le mot de passe) pour avoir son _id !
        const userWithoutPassword = newUser.toObject();
        delete userWithoutPassword.password;

        res.status(201).json({ message: "Compte et profil créés avec succès !", user: userWithoutPassword });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // 🔍 ÉTAPE 1 : On cherche l'utilisateur par son email uniquement
        const user = await User.findOne({ email: email });

        if (!user) {
            return res.status(401).json({ error: "Email ou mot de passe incorrect." });
        }

        // 🔒 ÉTAPE 2 : On compare le mot de passe tapé avec le hash de la BDD
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ error: "Email ou mot de passe incorrect." });
        }

        // Si tout est bon, on retire le mot de passe de l'objet avant de l'envoyer au front (meilleure pratique)
        const userWithoutPassword = user.toObject();
        delete userWithoutPassword.password;

        res.status(200).json({ message: "Connexion réussie !", user: userWithoutPassword });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/exercices', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20
        const exercices = await Exercice.aggregate([
            { $match: { 'proposition.0': { $exists: true } } },
            { $sample: { size: limit } }
        ]);
        console.log(`📡 Envoi de ${exercices.length} exercices au frontend`);
        res.json(exercices);
    } catch (err) {
        console.error("❌ Erreur lors de la récupération des exercices :", err);
        res.status(500).json({ error: err.message });
    }
});

// --- ROUTE : GÉNÉRATION DE TEST SUR MESURE (AVEC SÉCURITÉ ANTI-CRASH) ---
app.get('/api/recommandations/:userId', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });

        const nbQuestions = 10;
        console.log(`🧠 Demande d'un test IA de ${nbQuestions} questions pour ${user.pseudo}...`);

        // 🚨 RÉCUPÉRATION DU PROFIL
        const profilComplet = await Profilage.findOne({ user_id: user._id });

        let statsPourIA = {};
        if (profilComplet && profilComplet.performances_par_categorie) {
            profilComplet.performances_par_categorie.forEach(perf => {
                statsPourIA[perf.nom_categorie] = {
                    questions_vues: perf.statistiques_categorie.questions_vues,
                    taux_reussite: perf.statistiques_categorie.taux_reussite_categorie,
                    niveau_maitrise: perf.statistiques_categorie.niveau_maitrise
                };
            });
        }

        // 🧠 GESTION DU NOUVEAU JOUEUR (Le Démarrage à Froid)
        let contexteEtudiant = "";
        if (Object.keys(statsPourIA).length === 0) {
            contexteEtudiant = "C'est un TOUT NOUVEL étudiant. Son profil est vide. Génère un test de positionnement varié (mélange plusieurs catégories différentes) de niveau 'Facile' ou 'Moyenne' pour évaluer son niveau de base.";
        } else {
            contexteEtudiant = `Voici les statistiques de l'étudiant par catégorie : ${JSON.stringify(statsPourIA)}. Analyse ses lacunes (taux de réussite faible) et propose des questions ciblées pour le faire progresser.`;
        }

        const prompt = `
        Tu es le moteur de recommandation d'une école d'infirmiers.
        ${contexteEtudiant}
        
        Génère une recommandation pour EXACTEMENT ${nbQuestions} questions.
        RÈGLES VITALES :
        1. "difficulte" DOIT être "Facile", "Moyenne" ou "Difficile".
        2. "categorie" DOIT être "Dilution & Reconstitution", "Perfusion & Débits (Gouttes/min)", "Insuline & Héparine (Unités Internationales)", "Conversions & Pourcentages purs", "Pousse-Seringue & SAP (ml/h)", "Pédiatrie & Doses Poids-Dépendantes", "Réanimation & Catécholamines", "Transfusion Sanguine", "Oxygénothérapie & Gaz", ou "Nutrition & Alimentation".
        3. La somme totale des "quantite" DOIT être égale à ${nbQuestions}.
        RÉPONDS UNIQUEMENT AVEC UN OBJET JSON. Format strict :
        {"recommandations": [{"categorie": "Pédiatrie & Doses Poids-Dépendantes", "difficulte": "Moyenne", "quantite": 5, "raison": "Texte explicatif"}]}
        `;

        let ordonnanceIA;

        // 🚨 LE FILET DE SÉCURITÉ EST ICI
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt
            });
            const texteBrut = response.text.trim().replace(/```json/g, "").replace(/```/g, "");
            ordonnanceIA = JSON.parse(texteBrut);
            console.log("✅ Réponse IA reçue avec succès.");

        } catch (erreurIA) {
            // Si on arrive ici, c'est que l'Erreur 429 a frappé !
            console.warn("⚠️ Gemini est surchargé (Erreur Quota). Activation du mode dégradé !");

            // On tire 10 questions totalement au hasard dans toute la base
            const serieSecours = await Exercice.aggregate([{ $sample: { size: nbQuestions } }]);

            // On ajoute un petit mot pour que l'étudiant comprenne
            for (let q of serieSecours) {
                q.message_tuteur = "Série d'entraînement générale (Notre IA formateur fait une petite pause café ☕).";
            }
            return res.json(serieSecours); // On renvoie la série de secours et on s'arrête là
        }

        // Si l'IA a bien répondu, on fait le traitement normal
        let serieFinale = [];
        for (const consigne of ordonnanceIA.recommandations) {
            const questions = await Exercice.aggregate([
                { $match: { categories: consigne.categorie, difficulte: consigne.difficulte } },
                { $sample: { size: consigne.quantite } }
            ]);

            for (let q of questions) {
                q.message_tuteur = consigne.raison;
                serieFinale.push(q);
            }
        }

        res.json(serieFinale);
    } catch (err) {
        console.error("❌ Erreur serveur grave :", err);
        res.status(500).json({ error: "Erreur lors de la création du test." });
    }
});

// --- NOUVELLE ROUTE : SAUVEGARDE DES RÉSULTATS DANS LE PROFILAGE ---
app.post('/api/sauvegarder-resultats', async (req, res) => {
    try {
        const { userId, resultats } = req.body;

        // 🚨 SÉCURITÉ 1 : On vérifie que React envoie bien les résultats
        if (!resultats || resultats.length === 0) {
            console.log("⚠️ Attention : React a envoyé un tableau de résultats vide !");
            return res.status(400).json({ error: "Aucun résultat à sauvegarder." });
        }

        let profilComplet = await Profilage.findOne({ user_id: userId });

        // 🚨 SÉCURITÉ 2 : Si c'est un vieux compte de test sans profil, on le crée à la volée !
        if (!profilComplet) {
            console.log("🛠️ Ancien compte détecté : Création d'un profil vierge...");
            profilComplet = new Profilage({
                user_id: userId,
                anneeEtude: "1",
                statistiques_globales: { total_questions_rencontrees: 0, taux_reussite_global: 0, temps_moyen_global_sec: 0, score_elo: 1000 },
                embedding_utilisateur: [],
                performances_par_categorie: []
            });
            await profilComplet.save();
        }

        let performances = profilComplet.performances_par_categorie || [];
        let statsGlobales = profilComplet.statistiques_globales || {
            total_questions_rencontrees: 0, taux_reussite_global: 0, temps_moyen_global_sec: 0, score_elo: 1000
        };

        for (let rep of resultats) {
            const catNom = rep.categories && rep.categories.length > 0 ? rep.categories[0] : "Non catégorisé";

            let catIndex = performances.findIndex(p => p.nom_categorie === catNom);
            if (catIndex === -1) {
                performances.push({
                    nom_categorie: catNom,
                    statistiques_categorie: { questions_vues: 0, taux_reussite_categorie: 0, temps_moyen_categorie_sec: 25, niveau_maitrise: 0, poids_recommandation: 0.5 },
                    questions_rencontrees: []
                });
                catIndex = performances.length - 1;
            }

            let statsCat = performances[catIndex].statistiques_categorie;

            // 🧮 MATHS : Mise à jour de la catégorie
            const nvQuestions = statsCat.questions_vues + 1;
            const valeurReponse = rep.correct ? 100 : 0;
            statsCat.taux_reussite_categorie = ((statsCat.taux_reussite_categorie * statsCat.questions_vues) + valeurReponse) / nvQuestions;
            statsCat.questions_vues = nvQuestions;
            statsCat.niveau_maitrise = statsCat.taux_reussite_categorie / 100;

            // Mise à jour de l'historique de la question
            let qRecontreIndex = performances[catIndex].questions_rencontrees.findIndex(q => q.question_id && q.question_id.toString() === rep.questionId);
            if (qRecontreIndex === -1) {
                performances[catIndex].questions_rencontrees.push({
                    question_id: rep.questionId,
                    difficulte_question: rep.difficulte,
                    nb_tentatives_total: 0,
                    taux_reussite_question: 0,
                    historique_tentatives: []
                });
                qRecontreIndex = performances[catIndex].questions_rencontrees.length - 1;
            }

            let qRencontre = performances[catIndex].questions_rencontrees[qRecontreIndex];
            qRencontre.nb_tentatives_total += 1;
            qRencontre.taux_reussite_question = ((qRencontre.taux_reussite_question * (qRencontre.nb_tentatives_total - 1)) + valeurReponse) / qRencontre.nb_tentatives_total;

            qRencontre.historique_tentatives.push({
                date_tentative: new Date(),
                reussi: rep.correct
            });

            // 🧮 MATHS : Mise à jour du ELO Global
            statsGlobales.total_questions_rencontrees += 1;
            statsGlobales.score_elo += (rep.correct ? 15 : -15);
            if (statsGlobales.score_elo < 0) statsGlobales.score_elo = 0;
        }

        statsGlobales.derniere_activite = new Date();

        // 🚀 Sauvegarde finale MongoDB
        await Profilage.updateOne(
            { user_id: userId },
            { $set: { performances_par_categorie: performances, statistiques_globales: statsGlobales } }
        );

        console.log(`💾 Profil mis à jour pour l'utilisateur ${userId} ! Nouveau ELO : ${statsGlobales.score_elo}`);
        res.json({ message: "Profil mis à jour avec le nouveau format JSON !" });

    } catch (err) {
        console.error("❌ Erreur de sauvegarde :", err);
        res.status(500).json({ error: "Erreur lors de la sauvegarde du profil." });
    }
});

// --- 4. CHATBOT PÉDAGOGIQUE (Google Gemini) ---
const SYSTEM_INSTRUCTION = "Tu es un professeur bienveillant spécialisé en calculs de doses médicales pour des étudiants infirmiers. Tu expliques clairement et pas à pas. Tes réponses sont concises (max 3-4 phrases) sauf si l'étudiant demande plus de détails. Tu utilises un ton encourageant.";

app.post('/api/chat', async (req, res) => {
    try {
        const { sessionId, message, exercice } = req.body;

        if (!sessionId) {
            return res.status(400).json({ error: "sessionId requis" });
        }

        if (!chatSessions.has(sessionId)) {
            chatSessions.set(sessionId, []);
        }

        const history = chatSessions.get(sessionId);

        let prompt;
        if (exercice) {
            prompt = `L'étudiant a répondu "${exercice.mauvaiseReponse}" à la question : "${exercice.consigne}". Explique brièvement et avec bienveillance pourquoi cette réponse est incorrecte. Donne uniquement une explication pédagogique simple, sans révéler ni répéter la bonne réponse.`;
        } else {
            prompt = message;
        }

        history.push({ role: 'user', content: prompt });

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: SYSTEM_INSTRUCTION },
                ...history,
            ],
        });

        const reply = completion.choices[0].message.content;
        history.push({ role: 'assistant', content: reply });

        res.json({ reply });
    } catch (err) {
        console.error("Erreur chatbot :", err);
        res.status(500).json({ error: "Erreur lors de la génération de la réponse." });
    }
});

// Nettoyage des sessions inactives (toutes les 30 min)
setInterval(() => {
    chatSessions.clear();
}, 30 * 60 * 1000);

// --- 5. LANCEMENT DU SERVEUR ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Serveur backend lancé sur http://localhost:${PORT}`);
});