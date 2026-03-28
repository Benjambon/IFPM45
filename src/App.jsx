import { useState, useEffect, useRef } from 'react'
import confetti from 'canvas-confetti'
import './App.css'

// L'URL du serveur : localhost en dev, Render en prod
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
    const [loading, setLoading] = useState(false)
    const [selectedAnswer, setSelectedAnswer] = useState(null)

    // ÉTATS DU CHATBOT
    const [showChatbot, setShowChatbot] = useState(false)
    const [chatMessages, setChatMessages] = useState([])
    const [chatInput, setChatInput] = useState('')
    const [chatLoading, setChatLoading] = useState(false)
    const [chatSessionId, setChatSessionId] = useState(null)
    const chatMessagesRef = useRef(null)
    const [loadingQuiz, setLoadingQuiz] = useState(false);

    const lancerTestSurMesure = async () => {
        if (!currentUser) return;

        setLoadingQuiz(true);
        try {
            // On appelle la nouvelle route IA avec l'ID de l'utilisateur (MongoDB utilise _id)
            const res = await fetch(`${API_URL}/api/recommandations/${currentUser._id}`);
            if (res.ok) {
                const data = await res.json();
                // 🚨 AJOUTE CETTE LIGNE POUR ESPIONNER MONGODB :
                console.log("🧐 VOICI CE QUE MONGODB RENVOIE :", data[0]);
                setExercices(data);
                setCurrentQuestion(0);
                setScore(0);
                setQuizFinished(false);
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
    /*useEffect(() => {
        fetch(`${API_URL}/api/exercices`)
            .then(res => res.json())
            .then(data => { setExercices(data); setLoading(false) })
            .catch(err => { console.error(err); setLoading(false) })
    }, [])*/

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
                const data = await res.json(); // 🚨 NOUVEAU : On lit la réponse
                setCurrentUser(data.user);     // 🚨 NOUVEAU : On sauvegarde le VRAI profil avec son _id
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

        if (propo === exercices[currentQuestion].proposition_correct) {
            setScore(score + 1);

            // 🌟 MODIFICATION ICI : Calcul de la position du bouton cliqué
            // e.target est le bouton sur lequel l'utilisateur a cliqué
            const rect = e.target.getBoundingClientRect();

            // On calcule le centre du bouton en coordonnées normalisées (entre 0 et 1)
            // car canvas-confetti utilise ce format pour 'origin'.
            const originX = (rect.left + rect.width / 2) / window.innerWidth;
            const originY = (rect.top + rect.height / 2) / window.innerHeight;

            const defaults = {
                spread: 360,
                ticks: 50,
                gravity: 0,
                decay: 0.94,
                startVelocity: 25, // Légèrement réduit pour que ça ne parte pas trop loin du bouton
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
            // Logique chatbot inchangée...
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

    // Le reste du code reste inchangé...

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

    const handleNextQuestion = () => {
        const next = currentQuestion + 1;
        if (next < exercices.length) {
            setCurrentQuestion(next);
            setSelectedAnswer(null);
        } else {
            setQuizFinished(true);
            setSelectedAnswer(null);


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
                    <div style={{ marginTop: '40px' }}>
                        <button
                            className="btn btn-primary"
                            onClick={lancerTestSurMesure}
                            disabled={loadingQuiz}
                        >
                            {loadingQuiz ? "🧠 Création de ton test par l'IA..." : "Commencer le test"}
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

                            {exercices[currentQuestion]?.message_tuteur && (
                                <div style={{ backgroundColor: '#e0f2fe', color: '#075985', padding: '10px', borderRadius: '5px', marginBottom: '15px', fontStyle: 'italic', fontSize: '14px' }}>
                                    💡 <strong>Mot du formateur :</strong> {exercices[currentQuestion].message_tuteur}
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
                                            // L'objet événement 'e' est passé ici
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