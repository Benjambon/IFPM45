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
    anneeEtude: String
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

// --- 4. CHATBOT PÉDAGOGIQUE (OpenAI) ---
const openai = new OpenAI({ apiKey: process.env.API_KEY });
const chatSessions = new Map();

const SYSTEM_INSTRUCTION = "Tu es un professeur bienveillant spécialisé en calculs de doses médicales pour des étudiants infirmiers. Tu expliques clairement et pas à pas. Tes réponses sont concises (max 1-2 phrases) sauf si l'étudiant demande plus de détails. Tu utilises un ton encourageant. Pas de formules de politesses.";

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