import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import 'dotenv/config';
import bcrypt from 'bcrypt';
import OpenAI from 'openai';

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Initialisation de l'IA et des sessions du chatbot
const ai = new OpenAI({ apiKey: process.env.API_KEY });
const chatSessions = new Map();

// 1. CONNEXION SÉCURISÉE
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error("ERREUR CRITIQUE : La variable MONGO_URI est vide ou introuvable !");
    process.exit(1);
}

// Connexion standard
mongoose.connect(MONGO_URI)
    .then(() => console.log("Connecté à MongoDB avec succès !"))
    .catch(err => console.error("Erreur de connexion MongoDB :", err));

// 2. DÉFINITION DES SCHÉMAS

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

const exerciceSchema = new mongoose.Schema({
    path: String,
    consignes: String,
    reponses: String,
    proposition: [String],
    proposition_correct: String,
    difficulte: String,
    categories: [String]
}, { versionKey: false });

const Exercice = mongoose.model('Exercice', exerciceSchema, 'Exercices');

// Schéma mis à jour pour lire le JSON de profilage
const profilageSchema = new mongoose.Schema({
    user_id: mongoose.Schema.Types.ObjectId,
    statistiques_globales: Object
}, { collection: 'Profilage', versionKey: false, strict: false });

const Profilage = mongoose.model('Profilage', profilageSchema);

// 3. LES ROUTES

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

        const user = await User.findOne({ email: email });

        if (!user) {
            return res.status(401).json({ error: "Email ou mot de passe incorrect." });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ error: "Email ou mot de passe incorrect." });
        }

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
        console.log(`Envoi de ${exercices.length} exercices au frontend`);
        res.json(exercices);
    } catch (err) {
        console.error("Erreur lors de la récupération des exercices :", err);
        res.status(500).json({ error: err.message });
    }
});

// ROUTE : RÉCUPÉRATION DES STATISTIQUES UTILISATEUR
app.get('/api/statistiques/:userId', async (req, res) => {
    try {
        const stats = await Profilage.findOne({ user_id: req.params.userId });

        if (!stats || !stats.statistiques_globales) {
            return res.status(404).json({ error: "Statistiques introuvables pour cet utilisateur." });
        }

        res.json({
            taux_reussite: stats.statistiques_globales.taux_reussite_global,
            temps_moyen: stats.statistiques_globales.temps_moyen_global_sec
        });
    } catch (err) {
        console.error("Erreur serveur :", err);
        res.status(500).json({ error: "Erreur lors de la récupération des statistiques." });
    }
});

// ROUTE : GÉNÉRATION DE TEST SUR MESURE
app.get('/api/recommandations/:userId', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });

        const nbQuestions = 10;
        console.log(`Demande d'un test IA de ${nbQuestions} questions pour ${user.pseudo}...`);

        const profilComplet = await Profilage.findOne({ "profil_utilisateur.id_utilisateur": "USR-74892" });

        let stats = { niveau_global: "Débutant", historique: "Premier test" };
        if (profilComplet && profilComplet.profil_utilisateur && profilComplet.profil_utilisateur.competences) {
            stats = profilComplet.profil_utilisateur.competences;
        }

        const prompt = `
        Tu es le moteur de recommandation d'une école d'infirmiers.
        Voici les compétences de l'étudiant : ${JSON.stringify(stats)}
        Génère une recommandation pour EXACTEMENT ${nbQuestions} questions.
        RÈGLES VITALES :
        1. "difficulte" DOIT être "Facile", "Moyenne" ou "Difficile".
        2. "categorie" DOIT être "Dilution & Reconstitution", "Perfusion & Débits (Gouttes/min)", "Insuline & Héparine (Unités Internationales)", "Conversions & Pourcentages purs", "Pousse-Seringue & SAP (ml/h)", "Pédiatrie & Doses Poids-Dépendantes", "Réanimation & Catécholamines", "Transfusion Sanguine", "Oxygénothérapie & Gaz", ou "Nutrition & Alimentation".
        3. La somme totale des "quantite" DOIT être égale à ${nbQuestions}.
        RÉPONDS UNIQUEMENT AVEC UN OBJET JSON. Format strict :
        {"recommandations": [{"categorie": "Pédiatrie & Doses Poids-Dépendantes", "difficulte": "Moyenne", "quantite": 5, "raison": "Texte explicatif"}]}
        `;

        let ordonnanceIA;

        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt
            });
            const texteBrut = response.text.trim().replace(/```json/g, "").replace(/```/g, "");
            ordonnanceIA = JSON.parse(texteBrut);
            console.log("Réponse IA reçue avec succès.");

        } catch (erreurIA) {
            console.warn("Gemini est surchargé (Erreur Quota). Activation du mode dégradé !");

            const serieSecours = await Exercice.aggregate([{ $sample: { size: nbQuestions } }]);

            for (let q of serieSecours) {
                q.message_tuteur = "Série d'entraînement générale (Notre IA formateur fait une petite pause café).";
            }
            return res.json(serieSecours);
        }

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
        console.error("Erreur serveur grave :", err);
        res.status(500).json({ error: "Erreur lors de la création du test." });
    }
});

// 4. CHATBOT PÉDAGOGIQUE
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

        // Correction : utilisation de 'ai' au lieu de 'openai' pour correspondre à l'import
        const completion = await ai.chat.completions.create({
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

// 5. LANCEMENT DU SERVEUR
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Serveur backend lancé sur http://localhost:${PORT}`);
});