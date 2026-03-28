import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import 'dotenv/config';
import bcrypt from 'bcrypt'; // 🔒 NOUVEAU : Import de bcrypt
import { GoogleGenAI } from '@google/genai';

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// --- 1. CONNEXION SÉCURISÉE ---
const MONGO_URI = process.env.MONGO_URI;

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

const exerciceSchema = new mongoose.Schema({
    consigne: String,
    reponse: String,
    proposition: [String],
    difficulte: String,
    categories: [String]
}, { versionKey: false });

const Exercice = mongoose.model('Exercice', exerciceSchema, 'Exercices');

// --- 3. LES ROUTES ---

app.post('/api/register', async (req, res) => {
    try {
        const existingUser = await User.findOne({ email: req.body.email });
        if (existingUser) {
            return res.status(400).json({ error: "Cet email est déjà utilisé par un autre compte." });
        }

        // 🔒 SÉCURITÉ : On hache le mot de passe avant de l'enregistrer
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(req.body.password, saltRounds);

        // On crée un nouvel objet utilisateur avec le mot de passe haché
        const userData = { ...req.body, password: hashedPassword };

        const newUser = new User(userData);
        await newUser.save();

        // NOUVEAU : On renvoie l'utilisateur avec son _id
        const userWithoutPassword = newUser.toObject();
        delete userWithoutPassword.password;

        res.status(201).json({ message: "Compte et profil créés avec succès !" });
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
        const exercices = await Exercice.find();
        console.log(`📡 Envoi de ${exercices.length} exercices au frontend`);
        res.json(exercices);
    } catch (err) {
        console.error("❌ Erreur lors de la récupération des exercices :", err);
        res.status(500).json({ error: err.message });
    }
});

// --- NOUVELLE ROUTE : GÉNÉRATION DE TEST SUR MESURE ---
app.get('/api/recommandations/:userId', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });

        console.log(`🧠 Génération d'un test IA pour ${user.pseudo}...`);

        // Si l'utilisateur est nouveau, on lui donne un profil de base
        const stats = user.statistiques && Object.keys(user.statistiques).length > 0
            ? user.statistiques
            : { niveau_global: "Débutant", historique: "Premier test" };

        // 1. LE PROMPT VERROUILLÉ : On donne la liste exacte à Gemini
        const prompt = `
        Tu es le moteur de recommandation d'une école d'infirmiers.
        Profil de l'étudiant : ${JSON.stringify(stats)}
        Génère une série de 5 questions sur mesure.
        
        RÈGLES VITALES POUR LES VALEURS :
        - "difficulte" DOIT être l'une de ces chaînes exactes : "Facile", "Moyenne", "Difficile".
        - "categorie" DOIT être l'une de ces chaînes exactes : "Dilution & Reconstitution", "Perfusion & Débits (Gouttes/min)", "Insuline & Héparine (Unités Internationales)", "Conversions & Pourcentages purs", "Pousse-Seringue & SAP (ml/h)", "Pédiatrie & Doses Poids-Dépendantes", "Réanimation & Catécholamines", "Transfusion Sanguine", "Oxygénothérapie & Gaz", "Nutrition & Alimentation".
        
        RÉPONDS UNIQUEMENT AVEC UN OBJET JSON. Format strict attendu :
        {
          "recommandations": [
            {"categorie": "Pédiatrie & Doses Poids-Dépendantes", "difficulte": "Moyenne", "quantite": 5, "raison": "Texte court expliquant ce choix"}
          ]
        }`;

        // Appel à Gemini
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt
        });

        const texteBrut = response.text.trim().replace(/```json/g, "").replace(/```/g, "");
        const ordonnanceIA = JSON.parse(texteBrut);

        let serieFinale = [];

        // 2. LA NOUVELLE REQUÊTE MONGODB
        for (const consigne of ordonnanceIA.recommandations) {

            // MongoDB va chercher la chaîne exacte dans le tableau 'categories' et la string dans 'difficulte'
            const questions = await Exercice.aggregate([
                {
                    $match: {
                        categories: consigne.categorie,
                        difficulte: consigne.difficulte
                    }
                },
                { $sample: { size: consigne.quantite } }
            ]);

            for (let q of questions) {
                q.message_tuteur = consigne.raison;
                serieFinale.push(q);
            }
        }

        res.json(serieFinale);
    } catch (err) {
        console.error("❌ Erreur génération IA :", err);
        res.status(500).json({ error: "Erreur lors de la création du test sur mesure." });
    }
});

// --- 4. CHATBOT PÉDAGOGIQUE (Google Gemini) ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const chatSessions = new Map();

const SYSTEM_INSTRUCTION = "Tu es un professeur bienveillant spécialisé en calculs de doses médicales pour des étudiants infirmiers. Tu expliques clairement et pas à pas. Tes réponses sont concises (max 3-4 phrases) sauf si l'étudiant demande plus de détails. Tu utilises un ton encourageant.";

app.post('/api/chat', async (req, res) => {
    try {
        const { sessionId, message, exercice } = req.body;

        if (!sessionId) {
            return res.status(400).json({ error: "sessionId requis" });
        }

        if (!chatSessions.has(sessionId)) {
            chatSessions.set(sessionId, ai.chats.create({
                model: 'gemini-2.5-flash',
                config: { systemInstruction: SYSTEM_INSTRUCTION },
                history: [],
            }));
        }

        const chat = chatSessions.get(sessionId);

        let prompt;
        if (exercice) {
            prompt = `L'étudiant a répondu "${exercice.mauvaiseReponse}" à la question : "${exercice.consigne}". La bonne réponse est "${exercice.reponse}". Explique pourquoi c'est la bonne réponse et comment l'obtenir, de façon claire et pédagogique.`;
        } else {
            prompt = message;
        }

        const response = await chat.sendMessage({ message: prompt });
        res.json({ reply: response.text });
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