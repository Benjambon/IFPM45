import { useState, useEffect } from 'react'
import './App.css'

// 🌍 L'URL de ton serveur Render centralisée ici
const API_URL = 'https://ifpm-serveur.onrender.com'

function App() {
    const [view, setView] = useState('landing')
    const [currentUser, setCurrentUser] = useState(null)
    const [loginData, setLoginData] = useState({ email: '', password: '' })
    const [formData, setFormData] = useState({
        email: '', password: '', nom: '', prenom: '', pseudo: '',
        dateNaissance: '', genre: '', metier: '', dateDiplome: '', anneeEtude: ''
    })

    const [exercices, setExercices] = useState([])
    const [currentQuestion, setCurrentQuestion] = useState(0)
    const [score, setScore] = useState(0)
    const [quizFinished, setQuizFinished] = useState(false)
    const [loading, setLoading] = useState(true)
    const [selectedAnswer, setSelectedAnswer] = useState(null)

    useEffect(() => {
        fetch(`${API_URL}/api/exercices`)
            .then(res => res.json())
            .then(data => { setExercices(data); setLoading(false) })
            .catch(err => { console.error(err); setLoading(false) })
    }, [])

    const handleFormChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value })
    const handleLoginChange = (e) => setLoginData({ ...loginData, [e.target.name]: e.target.value })

    const handleRegister = async (e) => {
        e.preventDefault()
        try {
            const res = await fetch(`${API_URL}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })
            if (res.ok) {
                setCurrentUser({ pseudo: formData.pseudo })
                setView('home')
            } else {
                const data = await res.json()
                alert(data.error || "Erreur lors de l'inscription.")
            }
        } catch (err) { console.error(err) }
    }

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
                setCurrentUser(data.user)
                setView('home')
            } else {
                alert("Email ou mot de passe incorrect.")
            }
        } catch (err) { console.error(err) }
    }

    const handleLogout = () => {
        setCurrentUser(null)
        setLoginData({ email: '', password: '' })
        setView('landing')
    }

    const handleAnswer = (propo) => {
        // Empêcher de cliquer plusieurs fois
        if (selectedAnswer) return;

        setSelectedAnswer(propo);
        if (propo === exercices[currentQuestion].reponse) {
            setScore(score + 1);
        }
    }
    const handleNextQuestion = () => {
        const next = currentQuestion + 1;
        if (next < exercices.length) {
            setCurrentQuestion(next);
            setSelectedAnswer(null); // Réinitialise la sélection pour la question suivante
        } else {
            setQuizFinished(true);
            setSelectedAnswer(null);
        }
    }

    const resetGame = () => {
        setQuizFinished(false);
        setCurrentQuestion(0);
        setScore(0);
        setSelectedAnswer(null);
        setView('home');
    }

    if (loading) return <div className="App"><h1>Chargement...</h1></div>

    const progressPercentage = exercices.length > 0 ? ((currentQuestion) / exercices.length) * 100 : 0

    return (
        <div className="App">

            {view === 'landing' && (
                <div>
                    <h1>IFPM Training</h1>
                    <p className="subtitle">Maîtrise tes calculs de doses.</p>
                    <div style={{ marginTop: '50px' }}>
                        <button className="btn btn-primary" onClick={() => setView('register')}>C'est parti !</button>
                        <button className="btn btn-outline" onClick={() => setView('login')}>J'ai déjà un compte</button>
                    </div>
                </div>
            )}

            {view === 'login' && (
                <div>
                    <button className="btn-back" onClick={() => setView('landing')}>← Retour</button>
                    <h2>Bon retour !</h2>
                    <form onSubmit={handleLogin} className="form-group">
                        <input className="input-field" name="email" type="email" placeholder="Email" onChange={handleLoginChange} required />
                        <input className="input-field" name="password" type="password" placeholder="Mot de passe" onChange={handleLoginChange} required />
                        <button type="submit" className="btn btn-primary" style={{marginTop: '20px'}}>Se connecter</button>
                    </form>
                </div>
            )}

            {view === 'register' && (
                <div>
                    <button className="btn-back" onClick={() => setView('landing')}>← Retour</button>
                    <h2>Crée ton profil</h2>
                    <form onSubmit={(e) => { e.preventDefault(); setView('profile'); }} className="form-group">
                        <input className="input-field" name="email" type="email" placeholder="Email" onChange={handleFormChange} required />
                        <input className="input-field" name="password" type="password" placeholder="Mot de passe" onChange={handleFormChange} required />
                        <button type="submit" className="btn btn-secondary" style={{marginTop: '20px'}}>Continuer</button>
                    </form>
                </div>
            )}

            {view === 'profile' && (
                <div>
                    <button className="btn-back" onClick={() => setView('register')}>← Retour</button>
                    <h2>Encore quelques détails</h2>
                    <form onSubmit={handleRegister} className="form-group">
                        <input className="input-field" name="nom" placeholder="Nom" onChange={handleFormChange} required />
                        <input className="input-field" name="prenom" placeholder="Prénom" onChange={handleFormChange} required />
                        <input className="input-field" name="pseudo" placeholder="Pseudo" onChange={handleFormChange} required />

                        <label style={{ fontWeight: 'bold', color: 'var(--text-muted)', fontSize: '14px', marginTop: '10px' }}>Date de naissance</label>
                        <input className="input-field" name="dateNaissance" type="date" onChange={handleFormChange} required />

                        <select className="input-field" name="genre" onChange={handleFormChange} required>
                            <option value="">Genre</option>
                            <option value="Femme">Femme</option>
                            <option value="Homme">Homme</option>
                            <option value="Autre">Autre</option>
                        </select>

                        <select className="input-field" name="metier" onChange={handleFormChange} required>
                            <option value="">Profession</option>
                            <option value="Infirmier">Infirmier(e)</option>
                            <option value="Étudiant">Étudiant(e)</option>
                        </select>

                        {formData.metier === 'Infirmier' && <input className="input-field" name="dateDiplome" type="date" onChange={handleFormChange} required />}
                        {formData.metier === 'Étudiant' && (
                            <select className="input-field" name="anneeEtude" onChange={handleFormChange} required>
                                <option value="">Année d'étude</option>
                                <option value="1">1ère année</option>
                                <option value="2">2ème année</option>
                                <option value="3">3ème année</option>
                            </select>
                        )}
                        <button type="submit" className="btn btn-primary" style={{marginTop: '20px'}}>Terminer</button>
                    </form>
                </div>
            )}

            {view === 'home' && (
                <div>
                    <h1>Salut {currentUser?.pseudo || ""} !</h1>
                    <p className="subtitle">Prêt pour ton entraînement du jour ?</p>
                    <div style={{ marginTop: '40px' }}>
                        <button className="btn btn-primary" onClick={() => { setView('quiz'); setQuizFinished(false); setCurrentQuestion(0); setScore(0); }}>
                            Commencer le test
                        </button>
                        <button className="btn btn-outline" onClick={handleLogout} style={{ marginTop: '20px' }}>
                            Déconnexion
                        </button>
                    </div>
                </div>
            )}

            {view === 'quiz' && !quizFinished && (
                <div>
                    {exercices.length === 0 ? (
                        <div>
                            <h2>Aucun exercice trouvé</h2>
                            <button className="btn btn-secondary" onClick={() => setView('home')}>Retour</button>
                        </div>
                    ) : (
                        <>
                            <div className="progress-container">
                                <div className="progress-bar" style={{ width: `${progressPercentage}%` }}></div>
                            </div>

                            <div className="question-card">
                                {exercices[currentQuestion]?.consigne}
                            </div>

                            <div className="answers-grid">
                                {exercices[currentQuestion]?.proposition?.map((propo, i) => {
                                    const isCorrectAnswer = propo === exercices[currentQuestion].reponse;
                                    const isSelected = propo === selectedAnswer;

                                    let btnClass = "btn btn-outline";
                                    let btnStyle = {};

                                    // Si l'utilisateur a répondu, on applique les couleurs
                                    if (selectedAnswer) {
                                        if (isCorrectAnswer) {
                                            // La bonne réponse en vert
                                            btnClass = "btn btn-primary";
                                        } else if (isSelected && !isCorrectAnswer) {
                                            // La mauvaise réponse cliquée en rouge
                                            btnClass = "btn btn-danger";
                                        } else {
                                            // Les autres options sont grisées
                                            btnStyle = { opacity: 0.5, cursor: 'not-allowed' };
                                        }
                                    }

                                    return (
                                        <button
                                            key={i}
                                            className={btnClass}
                                            style={btnStyle}
                                            onClick={() => handleAnswer(propo)}
                                            disabled={!!selectedAnswer}
                                        >
                                            {propo}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Affichage du bouton "Suivant" uniquement si une réponse est sélectionnée */}
                            {selectedAnswer && (
                                <div style={{ marginTop: '30px' }}>
                                    <button className="btn btn-secondary" onClick={handleNextQuestion}>
                                        {currentQuestion + 1 < exercices.length ? "Prochaine question" : "Voir les résultats"}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {view === 'quiz' && quizFinished && (
                <div style={{ marginTop: '40px' }}>
                    <h1>Test Terminé !</h1>
                    <h2 style={{ color: 'var(--green)', fontSize: '32px', margin: '30px 0' }}>{score} / {exercices.length}</h2>
                    <button className="btn btn-primary" onClick={resetGame}>Continuer</button>
                </div>
            )}

        </div>
    )
}

export default App