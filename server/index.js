import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import 'dotenv/config';

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

// --- 4. LANCEMENT DU SERVEUR ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Serveur backend lancé sur http://localhost:${PORT}`);
});