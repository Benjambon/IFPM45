import { useState, useEffect } from 'react'
import './App.css'

// 🌍 L'URL de ton serveur Render centralisée ici
const API_URL = 'https://ifpm-serveur.onrender.com'

function App() {
    // --- GESTION DES ÉCRANS (landing, login, register, profile, home, quiz) ---
    const [view, setView] = useState('landing')

    // --- ÉTATS UTILISATEUR ---
    const [currentUser, setCurrentUser] = useState(null) // Stocke les infos de l'utilisateur connecté
    const [loginData, setLoginData] = useState({ email: '', password: '' })
    const [formData, setFormData] = useState({
        email: '', password: '', nom: '', prenom: '', pseudo: '',
        dateNaissance: '', genre: '', metier: '', dateDiplome: '', anneeEtude: ''
    })

    // --- ÉTATS DU JEU ---
    const [exercices, setExercices] = useState([])
    const [currentQuestion, setCurrentQuestion] = useState(0)
    const [score, setScore] = useState(0)
    const [quizFinished, setQuizFinished] = useState(false)
    const [loading, setLoading] = useState(true)

    // Chargement des exercices au démarrage
    useEffect(() => {
        fetch(`${API_URL}/api/exercices`)
            .then(res => res.json())
            .then(data => { setExercices(data); setLoading(false) })
            .catch(err => { console.error(err); setLoading(false) })
    }, [])

    // --- GESTION DES FORMULAIRES ---
    const handleFormChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value })
    const handleLoginChange = (e) => setLoginData({ ...loginData, [e.target.name]: e.target.value })

    // INSCRIPTION (Envoi final vers la BDD)
    const handleRegister = async (e) => {
        e.preventDefault()
        try {
            const res = await fetch(`${API_URL}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })
            if (res.ok) {
                alert("Compte et profil créés avec succès !")
                setCurrentUser({ pseudo: formData.pseudo }) // On simule la connexion avec le pseudo
                setView('home') // Go à l'accueil
            } else {
                const data = await res.json()
                alert(data.error || "Erreur lors de l'inscription.")
            }
        } catch (err) { console.error(err) }
    }

    // CONNEXION
    const handleLogin = async (e) => {
        e.preventDefault()
        try {
            const res = await fetch(`${API_URL}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(loginData)
            })
            if (res.ok) {
                const data = await res.json()
                setCurrentUser(data.user) // On stocke les infos renvoyées par la BDD
                setView('home') // Go à l'accueil
            } else {
                alert("Email ou mot de passe incorrect.")
            }
        } catch (err) { console.error(err) }
    }

    // DÉCONNEXION
    const handleLogout = () => {
        setCurrentUser(null)
        setLoginData({ email: '', password: '' })
        setView('landing')
    }

    // --- LOGIQUE DU JEU ---
    const handleAnswer = (propo) => {
        if (propo === exercices[currentQuestion].reponse) setScore(score + 1)
        const next = currentQuestion + 1
        if (next < exercices.length) setCurrentQuestion(next)
        else setQuizFinished(true)
    }

    const resetGame = () => {
        setQuizFinished(false)
        setCurrentQuestion(0)
        setScore(0)
        setView('home') // Retour au tableau de bord après le jeu
    }

    // --- RENDU ---
    if (loading) return <div className="App"><h1>Chargement des données...</h1></div>

    return (
        <div className="App">

            {/* 1. PAGE DE DÉMARRAGE (LANDING) */}
            {view === 'landing' && (
                <div style={{ marginTop: '50px' }}>
                    <h1>Bienvenue sur IFPM Training 💉</h1>
                    <p>La plateforme d'entraînement aux calculs de doses.</p>
                    <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginTop: '30px' }}>
                        <button onClick={() => setView('login')} style={{ width: '150px' }}>Se connecter</button>
                        <button onClick={() => setView('register')} style={{ width: '150px', backgroundColor: '#646cff', color: 'white' }}>S'inscrire</button>
                    </div>
                </div>
            )}

            {/* 2. PAGE DE CONNEXION */}
            {view === 'login' && (
                <div style={{ maxWidth: '350px', margin: 'auto', marginTop: '50px', textAlign: 'left' }}>
                    <button onClick={() => setView('landing')} style={{ marginBottom: '20px', background: 'transparent', border: '1px solid #ccc' }}>⬅ Retour</button>
                    <h2>Connexion</h2>
                    <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <input name="email" type="email" placeholder="Email" onChange={handleLoginChange} required style={{ padding: '10px' }} />
                        <input name="password" type="password" placeholder="Mot de passe" onChange={handleLoginChange} required style={{ padding: '10px' }} />
                        <button type="submit" style={{ backgroundColor: '#58cc02', color: 'white', padding: '10px' }}>Me connecter</button>
                    </form>
                </div>
            )}

            {/* 3. PAGE INSCRIPTION (Étape 1 : Identifiants) */}
            {view === 'register' && (
                <div style={{ maxWidth: '350px', margin: 'auto', marginTop: '50px', textAlign: 'left' }}>
                    <button onClick={() => setView('landing')} style={{ marginBottom: '20px', background: 'transparent', border: '1px solid #ccc' }}>⬅ Retour</button>
                    <h2>Créer un compte</h2>
                    <form onSubmit={(e) => { e.preventDefault(); setView('profile'); }} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <input name="email" type="email" placeholder="Email" onChange={handleFormChange} required style={{ padding: '10px' }} />
                        <input name="password" type="password" placeholder="Mot de passe" onChange={handleFormChange} required style={{ padding: '10px' }} />
                        <button type="submit" style={{ backgroundColor: '#646cff', color: 'white', padding: '10px' }}>Suivant ➡</button>
                    </form>
                </div>
            )}

            {/* 4. PAGE PROFIL (Étape 2 : Infos persos) */}
            {view === 'profile' && (
                <div style={{ maxWidth: '400px', margin: 'auto', marginTop: '20px', textAlign: 'left' }}>
                    <button onClick={() => setView('register')} style={{ marginBottom: '20px', background: 'transparent', border: '1px solid #ccc' }}>⬅ Retour</button>
                    <h2>Complète ton profil</h2>
                    <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <input name="nom" placeholder="Nom" onChange={handleFormChange} required style={{ padding: '8px' }}/>
                        <input name="prenom" placeholder="Prénom" onChange={handleFormChange} required style={{ padding: '8px' }}/>
                        <input name="pseudo" placeholder="Pseudo" onChange={handleFormChange} required style={{ padding: '8px' }}/>

                        <label style={{ fontSize: '12px', marginBottom: '-8px' }}>Date de naissance :</label>
                        <input name="dateNaissance" type="date" onChange={handleFormChange} required style={{ padding: '8px' }}/>

                        <select name="genre" onChange={handleFormChange} required style={{ padding: '8px' }}>
                            <option value="">-- Genre --</option>
                            <option value="Femme">Femme</option>
                            <option value="Homme">Homme</option>
                            <option value="Autre">Autre</option>
                        </select>

                        <select name="metier" onChange={handleFormChange} required style={{ padding: '8px', border: '2px solid #646cff' }}>
                            <option value="">-- Vous êtes ? --</option>
                            <option value="Infirmier">Infirmier</option>
                            <option value="Étudiant">Étudiant</option>
                        </select>

                        {formData.metier === 'Infirmier' && <input name="dateDiplome" type="date" onChange={handleFormChange} required style={{ padding: '8px' }}/>}
                        {formData.metier === 'Étudiant' && (
                            <select name="anneeEtude" onChange={handleFormChange} required style={{ padding: '8px' }}>
                                <option value="">-- Année d'étude --</option>
                                <option value="1">1ère année</option>
                                <option value="2">2ème année</option>
                                <option value="3">3ème année</option>
                            </select>
                        )}
                        <button type="submit" style={{ backgroundColor: '#58cc02', color: 'white', marginTop: '10px', padding: '12px' }}>Terminer l'inscription</button>
                    </form>
                </div>
            )}

            {/* 5. PAGE D'ACCUEIL CONNECTÉ (TABLEAU DE BORD) */}
            {view === 'home' && (
                <div style={{ marginTop: '50px' }}>
                    <h1>Bonjour {currentUser?.pseudo || "!"} 👋</h1>
                    <p>Prêt(e) à t'entraîner ?</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', marginTop: '30px' }}>
                        <button onClick={() => { setView('quiz'); setQuizFinished(false); setCurrentQuestion(0); setScore(0); }} style={{ width: '250px', backgroundColor: '#58cc02', color: 'white', fontSize: '1.2em', padding: '15px' }}>
                            🚀 Lancer un Test
                        </button>
                        <button onClick={handleLogout} style={{ width: '250px', backgroundColor: '#d9534f', color: 'white', padding: '10px' }}>
                            Déconnexion
                        </button>
                    </div>
                </div>
            )}

            {/* 6. LE QUIZ */}
            {view === 'quiz' && !quizFinished && (
                <div className="quiz-container" style={{ maxWidth: '500px', margin: 'auto', padding: '20px' }}>
                    {exercices.length === 0 ? (
                        <div style={{ color: '#d9534f', padding: '20px', border: '1px solid #d9534f', borderRadius: '8px' }}>
                            <h3>Aucun exercice trouvé ⚠️</h3>
                            <button onClick={() => setView('home')} style={{marginTop: '15px'}}>Retour à l'accueil</button>
                        </div>
                    ) : (
                        <>
                            <div className="progress-bar" style={{ marginBottom: '20px', color: '#646cff', fontWeight: 'bold' }}>
                                Question {currentQuestion + 1} / {exercices.length}
                            </div>
                            <div className="card" style={{ border: '2px solid #ddd', padding: '20px', borderRadius: '15px', textAlign: 'left', backgroundColor: 'white', color: '#333' }}>
                                <p style={{ fontSize: '1.2em', fontWeight: '500' }}>{exercices[currentQuestion]?.consigne}</p>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '20px' }}>
                                    {exercices[currentQuestion]?.proposition?.map((propo, i) => (
                                        <button key={i} onClick={() => handleAnswer(propo)} style={{ padding: '15px' }}>{propo}</button>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* 7. ÉCRAN DE RÉSULTATS */}
            {view === 'quiz' && quizFinished && (
                <div className="results" style={{ marginTop: '50px' }}>
                    <h2>🎉 Test Terminé !</h2>
                    <p style={{ fontSize: '1.5em' }}>Score : {score} / {exercices.length}</p>
                    <button onClick={resetGame} style={{ marginTop: '20px', padding: '10px 20px', backgroundColor: '#646cff', color: 'white' }}>
                        Retour au Tableau de bord
                    </button>
                </div>
            )}

        </div>
    )
}

export default App