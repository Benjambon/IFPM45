import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import 'dotenv/config';
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

// Connexion standard, sans les options de forçage IPv4
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
    anneeEtude: String
}, { versionKey: false });

const User = mongoose.model('User', userSchema);

const exerciceSchema = new mongoose.Schema({
    consigne: String,
    reponse: String,
    proposition: [String],
    difficulte: Number
}, { versionKey: false });

const Exercice = mongoose.model('Exercice', exerciceSchema, 'Exercices');

// --- 3. LES ROUTES ---

app.post('/api/register', async (req, res) => {
    try {
        const existingUser = await User.findOne({ email: req.body.email });
        if (existingUser) {
            return res.status(400).json({ error: "Cet email est déjà utilisé par un autre compte." });
        }

        const newUser = new User(req.body);
        await newUser.save();
        res.status(201).json({ message: "Compte et profil créés avec succès !" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email: email, password: password });

        if (!user) {
            return res.status(401).json({ error: "Email ou mot de passe incorrect." });
        }

        res.status(200).json({ message: "Connexion réussie !", user: user });
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