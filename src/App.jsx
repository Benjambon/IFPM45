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

    const [exercices, setExercices] = useState([]) // Toutes les questions de la BDD
    const [sessionExercices, setSessionExercices] = useState([]) // Les 10 questions du test en cours
    const [currentQuestion, setCurrentQuestion] = useState(0)
    const [score, setScore] = useState(0)
    const [quizFinished, setQuizFinished] = useState(false)
    const [loading, setLoading] = useState(true)
    const [selectedAnswer, setSelectedAnswer] = useState(null)
<<<<<<< Updated upstream
=======
    const [particles, setParticles] = useState([])

    // --- ÉTATS DU CHATBOT ---
    const [showChatbot, setShowChatbot] = useState(false)
    const [chatMessages, setChatMessages] = useState([])
    const [chatInput, setChatInput] = useState('')
    const [chatLoading, setChatLoading] = useState(false)
    const [chatSessionId, setChatSessionId] = useState(null)
    const chatMessagesRef = useRef(null)
>>>>>>> Stashed changes

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

<<<<<<< Updated upstream
    const handleAnswer = (propo) => {
        // Empêcher de cliquer plusieurs fois
=======
    // --- LOGIQUE DU JEU ---

    const startQuiz = () => {
        // 🔄 NOUVEAUTÉ : On mélange toutes les questions et on en prend 10
        const shuffled = [...exercices].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 10);

        setSessionExercices(selected);
        setView('quiz');
        setQuizFinished(false);
        setCurrentQuestion(0);
        setScore(0);
        setSelectedAnswer(null);
    }

    const handleAnswer = async (propo, e) => {
>>>>>>> Stashed changes
        if (selectedAnswer) return;

        setSelectedAnswer(propo);
<<<<<<< Updated upstream
        if (propo === exercices[currentQuestion].reponse) {
            setScore(score + 1);
        }
    }
=======

        // On utilise sessionExercices au lieu de exercices
        if (propo === sessionExercices[currentQuestion].proposition_correct) {
            setScore(score + 1);
            const newParticles = Array.from({ length: 10 }).map((_, i) => ({
                id: Date.now() + i,
                x: e.clientX,
                y: e.clientY,
                tx: `${(Math.random() - 0.5) * 500}px`,
                tyUp: `${-(Math.random() * 200 + 100)}px`,
                txEnd: `${(Math.random() - 0.5) * 1000}px`,
                rotHalf: `${Math.random() * 180}deg`,
                rotFull: `${Math.random() * 360 + 180}deg`
            }));

            setParticles(newParticles);

            setTimeout(() => {
                setParticles([]);
            }, 2500);
        } else {
            const newSessionId = `chat_${Date.now()}_${Math.random().toString(36).slice(2)}`;
            setChatSessionId(newSessionId);
            setChatMessages([]);
            setChatLoading(true);
            setShowChatbot(true);

            try {
                const res = await fetch(`${API_URL}/api/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId: newSessionId,
                        exercice: {
                            consigne: sessionExercices[currentQuestion].consignes,
                            reponse: sessionExercices[currentQuestion].proposition_correct,
                            explication_calcul: sessionExercices[currentQuestion].reponses,
                            mauvaiseReponse: propo
                        }
                    })
                });
                const data = await res.json();
                setChatMessages([{ role: 'bot', text: data.reply }]);
            } catch (err) {
                setChatMessages([{ role: 'bot', text: "Désolé, je n'ai pas pu me connecter. La bonne réponse est : " + sessionExercices[currentQuestion].proposition_correct }]);
            }
            setChatLoading(false);
        }
    }

    const sendChatMessage = async () => {
        if (!chatInput.trim() || chatLoading) return;

        const userMsg = chatInput.trim();
        setChatInput('');
        setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setChatLoading(true);

        try {
            const res = await fetch(`${API_URL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: chatSessionId, message: userMsg })
            });
            const data = await res.json();
            setChatMessages(prev => [...prev, { role: 'bot', text: data.reply }]);
        } catch (err) {
            setChatMessages(prev => [...prev, { role: 'bot', text: "Erreur de connexion, réessaie." }]);
        }
        setChatLoading(false);
    }

    const handleChatKeyDown = (e) => {
        if (e.key === 'Enter') sendChatMessage();
    }

    const handleCloseChatbot = () => {
        setShowChatbot(false);
        setChatMessages([]);
        setChatSessionId(null);
        setChatInput('');
        handleNextQuestion();
    }

    useEffect(() => {
        if (chatMessagesRef.current) {
            chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
        }
    }, [chatMessages, chatLoading])

>>>>>>> Stashed changes
    const handleNextQuestion = () => {
        const next = currentQuestion + 1;
        // On vérifie la taille de la session (max 10)
        if (next < sessionExercices.length) {
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

    const progressPercentage = sessionExercices.length > 0 ? ((currentQuestion) / sessionExercices.length) * 100 : 0

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
                        <button className="btn btn-primary" onClick={startQuiz}>
                            Commencer un test de 10 questions
                        </button>
                        <button className="btn btn-outline" onClick={handleLogout} style={{ marginTop: '20px' }}>
                            Déconnexion
                        </button>
                    </div>
                </div>
            )}

            {view === 'quiz' && !quizFinished && (
                <div>
                    {sessionExercices.length === 0 ? (
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
<<<<<<< Updated upstream
                                {exercices[currentQuestion]?.consigne}
                            </div>

                            <div className="answers-grid">
                                {exercices[currentQuestion]?.proposition?.map((propo, i) => {
                                    const isCorrectAnswer = propo === exercices[currentQuestion].reponse;
=======
                                {sessionExercices[currentQuestion]?.consignes}
                            </div>

                            <div className="answers-grid">
                                {sessionExercices[currentQuestion]?.proposition?.map((propo, i) => {
                                    const isCorrectAnswer = propo === sessionExercices[currentQuestion].proposition_correct;
>>>>>>> Stashed changes
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

<<<<<<< Updated upstream
                            {/* Affichage du bouton "Suivant" uniquement si une réponse est sélectionnée */}
                            {selectedAnswer && (
=======
                            {selectedAnswer && selectedAnswer === sessionExercices[currentQuestion]?.proposition_correct && (
>>>>>>> Stashed changes
                                <div style={{ marginTop: '30px' }}>
                                    <button className="btn btn-secondary" onClick={handleNextQuestion}>
                                        {currentQuestion + 1 < sessionExercices.length ? "Prochaine question" : "Voir les résultats"}
                                    </button>
                                </div>
                            )}
<<<<<<< Updated upstream
=======

                            {showChatbot && (
                                <div className="chatbot-overlay">
                                    <div className="chatbot-sheet">
                                        <div className="chatbot-header">
                                            <span>Prof assistant</span>
                                            <button className="btn btn-primary" onClick={handleCloseChatbot}>J'ai compris</button>
                                        </div>
                                        <div className="chatbot-messages" ref={chatMessagesRef}>
                                            {chatMessages.map((msg, i) => (
                                                <div key={i} className={msg.role === 'user' ? 'chatbot-message-user' : 'chatbot-message-bot'}>
                                                    {msg.text}
                                                </div>
                                            ))}
                                            {chatLoading && <div className="chatbot-typing">...</div>}
                                        </div>
                                        <div className="chatbot-input-row">
                                            <input
                                                value={chatInput}
                                                onChange={e => setChatInput(e.target.value)}
                                                onKeyDown={handleChatKeyDown}
                                                placeholder="Pose une question..."
                                                disabled={chatLoading}
                                            />
                                            <button onClick={sendChatMessage} disabled={chatLoading || !chatInput.trim()}>
                                                Envoyer
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
>>>>>>> Stashed changes
                        </>
                    )}
                </div>
            )}

            {view === 'quiz' && quizFinished && (
                <div style={{ marginTop: '40px' }}>
                    <h1>Test Terminé !</h1>
                    <h2 style={{ color: 'var(--green)', fontSize: '32px', margin: '30px 0' }}>{score} / {sessionExercices.length}</h2>
                    <button className="btn btn-primary" onClick={resetGame}>Continuer</button>
                </div>
            )}

        </div>
    )
}

export default App