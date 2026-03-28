import { useState, useEffect, useRef } from 'react'
import confetti from 'canvas-confetti'
import './App.css'

const API_URL = import.meta.env.DEV ? 'http://localhost:5000' : 'https://ifpm-serveur.onrender.com'

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
    const [historiqueReponses, setHistoriqueReponses] = useState([])
    const [loading, setLoading] = useState(false)
    const [selectedAnswer, setSelectedAnswer] = useState(null)
    const [userStats, setUserStats] = useState(null)

    // ÉTATS DU CHATBOT
    const [showChatbot, setShowChatbot] = useState(false)
    const [chatMessages, setChatMessages] = useState([])
    const [chatInput, setChatInput] = useState('')
    const [chatLoading, setChatLoading] = useState(false)
    const [chatSessionId, setChatSessionId] = useState(null)
    const chatMessagesRef = useRef(null)
    const [loadingQuiz, setLoadingQuiz] = useState(false)

    const lancerTestSurMesure = async () => {
        if (!currentUser) return;

        setLoadingQuiz(true);
        try {
            const res = await fetch(`${API_URL}/api/recommandations/${currentUser._id}`);
            if (res.ok) {
                const data = await res.json();
                console.log("Données reçues de la base :", data[0]);
                setExercices(data);
                setCurrentQuestion(0);
                setScore(0);
                setQuizFinished(false);
                setHistoriqueReponses([]);
                setView('quiz');
            } else {
                alert("Erreur lors de la génération du test.");
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingQuiz(false);
        }
    };

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
                const data = await res.json();
                setCurrentUser(data.user);
                setView('home');
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

    const handleAnswer = async (propo, e) => {
        if (selectedAnswer) return;
        setSelectedAnswer(propo);

        // 🚨 CORRECTION 1 : On vérifie la réponse ET on la sauvegarde dans l'historique !
        const isCorrectAnswer = propo === exercices[currentQuestion].proposition_correct;

        setHistoriqueReponses(prev => [...prev, {
            questionId: exercices[currentQuestion]._id,
            categories: exercices[currentQuestion].categories,
            difficulte: exercices[currentQuestion].difficulte,
            correct: isCorrectAnswer
        }]);

        if (propo === exercices[currentQuestion].proposition_correct) {
            setScore(score + 1);

            const rect = e.target.getBoundingClientRect();

            const originX = (rect.left + rect.width / 2) / window.innerWidth;
            const originY = (rect.top + rect.height / 2) / window.innerHeight;

            const defaults = {
                spread: 360,
                ticks: 50,
                gravity: 0,
                decay: 0.94,
                startVelocity: 25,
                colors: ['FFE400', 'FFBD00', 'E89400', 'FFCA6C', 'FDFFB8'],
                origin: { x: originX, y: originY }
            };

            const shoot = () => {
                confetti({
                    ...defaults,
                    particleCount: 40,
                    scalar: 1.2,
                    shapes: ['star']
                });
            };

            setTimeout(shoot, 0);
        } else {
            const newSessionId = `chat_${Date.now()}_${Math.random().toString(36).slice(2)}`;
            setChatSessionId(newSessionId);
            setChatMessages([{ role: 'bot', text: `La bonne réponse est : ${exercices[currentQuestion].proposition_correct}` }]);
            setChatLoading(true);
            setShowChatbot(true);

            try {
                const res = await fetch(`${API_URL}/api/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId: newSessionId,
                        exercice: {
                            consigne: exercices[currentQuestion].consignes,
                            reponse: exercices[currentQuestion].proposition_correct,
                            explication_calcul: exercices[currentQuestion].reponses,
                            mauvaiseReponse: propo
                        }
                    })
                });
                if (!res.ok) throw new Error('server_error');
                const data = await res.json();
                setChatMessages(prev => [...prev, { role: 'bot', text: data.reply }]);
            } catch (err) {
                setChatMessages(prev => [...prev, { role: 'bot', text: "erreur" }]);
            }
            setChatLoading(false);
        }
    }

    const voirStatistiques = async () => {
        if (!currentUser) return;
        try {
            const res = await fetch(`${API_URL}/api/statistiques/${currentUser._id}`);
            if (res.ok) {
                const data = await res.json();
                setUserStats(data);
                setView('statistiques');
            } else {
                alert("Aucune statistique trouvée pour ce compte.");
            }
        } catch (err) {
            console.error("Erreur de fetch :", err);
        }
    };

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
            if (!res.ok) throw new Error('server_error');
            const data = await res.json();
            setChatMessages(prev => [...prev, { role: 'bot', text: data.reply }]);
        } catch (err) {
            setChatMessages(prev => [...prev, { role: 'bot', text: "erreur" }]);
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

    const handleNextQuestion = async () => {
        const next = currentQuestion + 1;
        if (next < exercices.length) {
            setCurrentQuestion(next);
            setSelectedAnswer(null);
        } else {
            // C'est la fin du test !
            setQuizFinished(true);
            setSelectedAnswer(null);

            // 🚨 ON ENVOIE LES RÉSULTATS AU SERVEUR
            try {
                await fetch(`${API_URL}/api/sauvegarder-resultats`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: currentUser._id,
                        resultats: historiqueReponses
                    })
                });
                console.log("✅ Statistiques et ELO sauvegardés avec succès !");
            } catch (err) {
                console.error("Erreur de sauvegarde :", err);
            }

            confetti({
                particleCount: 150,
                spread: 100,
                origin: { y: 0.5 }
            });
        }
    }

    const resetGame = () => {
        setQuizFinished(false);
        setCurrentQuestion(0);
        setScore(0);
        setSelectedAnswer(null);
        setShowChatbot(false);
        setChatMessages([]);
        setChatSessionId(null);
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
                        <button className="btn btn-primary" onClick={() => setView('register')}>S'inscrire</button>
                        <button className="btn btn-outline" onClick={() => setView('login')}>Se connecter</button>
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
                    <div style={{ marginTop: '40px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <button
                            className="btn btn-primary"
                            onClick={lancerTestSurMesure}
                            disabled={loadingQuiz}
                        >
                            {loadingQuiz ? "Création de ton test par l'IA..." : "Commencer le test"}
                        </button>
                        <button className="btn btn-secondary" onClick={voirStatistiques}>
                            Statistiques
                        </button>
                        <button className="btn btn-outline" onClick={handleLogout}>
                            Déconnexion
                        </button>
                    </div>
                </div>
            )}

            {view === 'statistiques' && (
                <div>
                    <button className="btn-back" onClick={() => setView('home')}>← Retour</button>
                    <h2>Tes Statistiques</h2>
                    {userStats ? (
                        <div style={{ marginTop: '20px', textAlign: 'center' }}>
                            <div style={{ padding: '20px', backgroundColor: 'var(--gray-bg)', borderRadius: '16px', marginBottom: '20px' }}>
                                <h3 style={{ margin: '0 0 10px 0', color: 'var(--text-muted)' }}>Score ELO 🏆</h3>
                                <p style={{ fontSize: '32px', fontWeight: '800', color: 'var(--blue)', margin: 0 }}>
                                    {userStats.score_elo}
                                </p>
                            </div>
                            <div style={{ padding: '20px', backgroundColor: 'var(--gray-bg)', borderRadius: '16px', marginBottom: '20px' }}>
                                <h3 style={{ margin: '0 0 10px 0', color: 'var(--text-muted)' }}>Taux de réussite</h3>
                                <p style={{ fontSize: '32px', fontWeight: '800', color: 'var(--green)', margin: 0 }}>
                                    {userStats.taux_reussite}%
                                </p>
                            </div>
                        </div>
                    ) : (
                        <p>Chargement des statistiques...</p>
                    )}
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

                            {exercices[currentQuestion]?.message_tuteur && (
                                <div style={{ backgroundColor: '#e0f2fe', color: '#075985', padding: '10px', borderRadius: '5px', marginBottom: '15px', fontStyle: 'italic', fontSize: '14px' }}>
                                    <strong>Mot du formateur :</strong> {exercices[currentQuestion].message_tuteur}
                                </div>
                            )}

                            <div className="question-card">
                                {exercices[currentQuestion]?.consignes}
                            </div>

                            <div className="answers-grid">
                                {exercices[currentQuestion]?.proposition?.map((propo, i) => {
                                    const isCorrectAnswer = propo === exercices[currentQuestion].proposition_correct;
                                    const isSelected = propo === selectedAnswer;

                                    let btnClass = "btn btn-outline";
                                    let btnStyle = {};

                                    if (selectedAnswer) {
                                        if (isCorrectAnswer) {
                                            btnClass = "btn btn-success";
                                        } else if (isSelected && !isCorrectAnswer) {
                                            btnClass = "btn btn-danger";
                                        } else {
                                            btnStyle = { opacity: 0.5, cursor: 'not-allowed' };
                                        }
                                    }

                                    return (
                                        <button
                                            key={i}
                                            className={btnClass}
                                            style={btnStyle}
                                            onClick={(e) => handleAnswer(propo, e)}
                                            disabled={!!selectedAnswer}
                                        >
                                            {propo}
                                        </button>
                                    );
                                })}
                            </div>

                            {selectedAnswer && selectedAnswer === exercices[currentQuestion]?.proposition_correct && (
                                <div style={{ marginTop: '30px' }}>
                                    <button className="btn btn-secondary" onClick={handleNextQuestion}>
                                        {currentQuestion + 1 < exercices.length ? "Prochaine question" : "Voir les résultats"}
                                    </button>
                                </div>
                            )}

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
                                            {chatLoading && <div className="chatbot-typing"><div className="chatbot-spinner"></div></div>}
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