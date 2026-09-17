'use client';

import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import TinderCard from 'react-tinder-card';
import { Heart, Plus, Trash2, ArrowRight, CheckCircle, HeartHandshake, Sparkles, Trophy, Award, LogOut, UserCheck } from 'lucide-react';

export default function Home() {
  const [phase, setPhase] = useState(1); // 1 = Nomi, 2 = Swipe, 3 = Classifica
  const [userName, setUserName] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentInput, setCurrentInput] = useState('');
  const [names, setNames] = useState<any[]>([]);
  const [allNamesToVote, setAllNamesToVote] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [votedCount, setVotedCount] = useState(0);
  const [loginMessage, setLoginMessage] = useState('');

  // Caricamento utente salvato in locale al caricamento della pagina
  useEffect(() => {
    const savedUser = localStorage.getItem('nomi_bambina_user');
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      setCurrentUser(parsed);
      fetchUserNames(parsed.id);
    }
  }, []);

  // Recupera i nomi inseriti dall'utente corrente
  const fetchUserNames = async (userId: any) => {
    const { data } = await supabase
        .from('names')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

    if (data) setNames(data);
  };

  // Carica i nomi da votare per lo Swipe (Fase 2)
  const fetchAllNamesForVoting = async () => {
    if (!currentUser) return;
    setLoading(true);

    const { data: myVotes } = await supabase
        .from('votes')
        .select('name_id')
        .eq('user_id', currentUser.id);

    const votedNameIds = myVotes ? myVotes.map((v) => v.name_id) : [];

    const { data: allNames } = await supabase.from('names').select('*');

    if (allNames) {
      const unvoted = allNames.filter((n) => !votedNameIds.includes(n.id));
      setAllNamesToVote(unvoted);
      setVotedCount(votedNameIds.length);
    }
    setLoading(false);
  };

  // Carica i dati per la Classifica (Fase 3)
  const fetchLeaderboard = async () => {
    setLoading(true);

    const { data: allNames } = await supabase.from('names').select('*');
    const { data: allVotes } = await supabase.from('votes').select('*').eq('is_liked', true);

    if (allNames) {
      const scores = allNames.map((n) => {
        const likes = allVotes ? allVotes.filter((v) => v.name_id === n.id).length : 0;
        return { id: n.id, text: n.name_text, likes };
      });

      scores.sort((a, b) => b.likes - a.likes);
      setLeaderboard(scores);
    }
    setLoading(false);
  };

  // Cambio Fase
  const handleSwitchPhase = (newPhase: any) => {
    setPhase(newPhase);
    if (newPhase === 2) fetchAllNamesForVoting();
    if (newPhase === 3) fetchLeaderboard();
  };

  // Login o Registrazione automatica per nome
  const handleLogin = async (e: any) => {
    e.preventDefault();
    const cleanName = userName.trim();
    if (!cleanName) return;
    setLoading(true);
    setLoginMessage('');

    // 1. Cerca se l'utente esiste già
    const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .ilike('name', cleanName)
        .maybeSingle();

    if (existingUser) {
      // Utente trovato! Effettua il login
      setCurrentUser(existingUser);
      localStorage.setItem('nomi_bambina_user', JSON.stringify(existingUser));
      fetchUserNames(existingUser.id);
      setLoginMessage('Bentornato!');
    } else {
      // 2. Se non esiste, crea un nuovo utente
      const { data: newUser, error } = await supabase
          .from('users')
          .insert([{ name: cleanName }])
          .select()
          .single();

      if (!error && newUser) {
        setCurrentUser(newUser);
        localStorage.setItem('nomi_bambina_user', JSON.stringify(newUser));
        fetchUserNames(newUser.id);
      }
    }
    setLoading(false);
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('nomi_bambina_user');
    setCurrentUser(null);
    setNames([]);
    setUserName('');
    setPhase(1);
  };

  // Inserimento nome
  const handleAddName = async (e: any) => {
    e.preventDefault();
    const cleanName = currentInput.trim();
    if (cleanName && names.length < 10 && currentUser) {
      setLoading(true);
      const { data } = await supabase
          .from('names')
          .insert([{ user_id: currentUser.id, name_text: cleanName }])
          .select()
          .single();

      if (data) {
        setNames([...names, data]);
        setCurrentInput('');
      }
      setLoading(false);
    }
  };

  // Cancellazione nome
  const handleRemoveName = async (idToRemove: any) => {
    setLoading(true);
    const { error } = await supabase.from('names').delete().eq('id', idToRemove);
    if (!error) {
      setNames(names.filter((n) => n.id !== idToRemove));
    }
    setLoading(false);
  };

  // Swipe Tinder
  const handleSwiped = async (direction: any, nameItem: any) => {
    const isLiked = direction === 'right';

    if (!currentUser) return;

    await supabase.from('votes').insert([
      {
        user_id: currentUser.id,
        name_id: nameItem.id,
        is_liked: isLiked,
      },
    ]);

    setAllNamesToVote((prev) => prev.filter((item) => item.id !== nameItem.id));
    setVotedCount((prev) => prev + 1);
  };

  return (
      <main className="min-h-screen bg-gradient-to-b from-pink-100 to-pink-50 flex flex-col items-center justify-center p-4 select-none">
        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-2xl max-w-md w-full border border-pink-100 relative min-h-[520px] flex flex-col justify-between">

          {/* Intestazione */}
          <div>
            <div className="text-center mb-4 relative">
              <div className="bg-pink-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2">
                <Heart className="w-6 h-6 text-pink-500 fill-pink-500" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800">Scegliamo il Nome!</h1>

              {currentUser && (
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <p className="text-xs text-gray-500">
                      Ciao <span className="font-bold text-pink-600">{currentUser.name}</span>
                    </p>
                    <button
                        onClick={handleLogout}
                        title="Cambia Utente"
                        className="text-gray-400 hover:text-red-500 transition p-1"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  </div>
              )}
            </div>

            {/* Navigazione Fasi */}
            {currentUser && (
                <div className="flex bg-pink-50 p-1 rounded-2xl mb-6 border border-pink-100">
                  <button
                      onClick={() => handleSwitchPhase(1)}
                      className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
                          phase === 1 ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-500'
                      }`}
                  >
                    1. Nomi
                  </button>
                  <button
                      onClick={() => handleSwitchPhase(2)}
                      className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1 ${
                          phase === 2 ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-500'
                      }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" /> 2. Swipe
                  </button>
                  <button
                      onClick={() => handleSwitchPhase(3)}
                      className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1 ${
                          phase === 3 ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-500'
                      }`}
                  >
                    <Trophy className="w-3.5 h-3.5" /> 3. Classifica
                  </button>
                </div>
            )}
          </div>

          {/* SCHERMATA LOGIN / REGISTRAZIONE */}
          {!currentUser && (
              <form onSubmit={handleLogin} className="space-y-4 my-auto">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Come ti chiami?
                  </label>
                  <p className="text-xs text-gray-400 mb-2">
                    Inserisci il tuo nome. Se hai già acceduto prima, verrai riconosciuto automaticamente!
                  </p>
                  <input
                      type="text"
                      placeholder="Es. Zio Marco"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-pink-300 focus:outline-none text-gray-800"
                      required
                  />
                </div>
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-pink-500 text-white font-semibold py-2.5 rounded-xl hover:bg-pink-600 transition flex items-center justify-center gap-2"
                >
                  {loading ? 'Verifica in corso...' : 'Entra o Registrati'} <ArrowRight className="w-4 h-4" />
                </button>
              </form>
          )}

          {/* FASE 1: INSERIMENTO NOMI */}
          {currentUser && phase === 1 && (
              <div className="space-y-4 my-auto">
                {names.length < 10 ? (
                    <form onSubmit={handleAddName} className="flex gap-2">
                      <input
                          type="text"
                          placeholder="Scrivi un nome..."
                          value={currentInput}
                          onChange={(e) => setCurrentInput(e.target.value)}
                          className="flex-1 px-4 py-2 border rounded-xl focus:ring-2 focus:ring-pink-300 focus:outline-none text-gray-800"
                      />
                      <button
                          type="submit"
                          disabled={!currentInput.trim() || loading}
                          className="bg-pink-500 text-white p-2.5 rounded-xl hover:bg-pink-600 disabled:opacity-50"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </form>
                ) : (
                    <p className="text-center text-sm font-semibold text-green-600 bg-green-50 p-2 rounded-xl">
                      Hai raggiunto il limite di 10 nomi! 🎉
                    </p>
                )}

                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span>I tuoi nomi inseriti:</span>
                  <span className="font-bold text-pink-600">{names.length} / 10</span>
                </div>

                <ul className="space-y-2 max-h-48 overflow-y-auto">
                  {names.map((item) => (
                      <li
                          key={item.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100"
                      >
                        <span className="font-medium text-gray-700">{item.name_text}</span>
                        <button
                            onClick={() => handleRemoveName(item.id)}
                            className="text-gray-400 hover:text-red-500 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </li>
                  ))}
                </ul>
              </div>
          )}

          {/* FASE 2: SWIPE */}
          {currentUser && phase === 2 && (
              <div className="flex-1 flex flex-col items-center justify-center relative my-4">
                {loading ? (
                    <p className="text-gray-400 text-sm">Caricamento nomi...</p>
                ) : allNamesToVote.length > 0 ? (
                    <div className="relative w-full h-64 flex items-center justify-center">
                      {allNamesToVote.map((item) => (
                          <TinderCard
                              key={item.id}
                              onSwipe={(dir) => handleSwiped(dir, item)}
                              preventSwipe={['up', 'down']}
                              className="absolute w-full h-full"
                          >
                            <div className="w-full h-full bg-gradient-to-br from-pink-400 to-pink-500 rounded-3xl shadow-xl flex flex-col items-center justify-center text-white p-6 cursor-grab active:cursor-grabbing border-4 border-white">
                              <HeartHandshake className="w-12 h-12 mb-3 text-pink-200" />
                              <h2 className="text-3xl font-extrabold tracking-wide drop-shadow-md">
                                {item.name_text}
                              </h2>
                              <div className="flex gap-8 mt-6 text-xs text-pink-100 font-medium">
                                <span>👈 Swipe Sinistra: No</span>
                                <span>Swipe Destra: Sì 👉</span>
                              </div>
                            </div>
                          </TinderCard>
                      ))}
                    </div>
                ) : (
                    <div className="text-center py-8">
                      <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                      <h3 className="font-bold text-gray-800">Hai votato tutti i nomi!</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        Vai al tab **3. Classifica** per vedere i risultati!
                      </p>
                    </div>
                )}
              </div>
          )}

          {/* FASE 3: CLASSIFICA */}
          {currentUser && phase === 3 && (
              <div className="space-y-3 my-2 flex-1 flex flex-col justify-center">
                <h3 className="text-center font-bold text-gray-700 text-sm mb-2 flex items-center justify-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-500" /> Classifica Generale dei Nomi
                </h3>

                {loading ? (
                    <p className="text-center text-gray-400 text-sm">Calcolo classifica...</p>
                ) : leaderboard.length > 0 ? (
                    <ul className="space-y-2 max-h-64 overflow-y-auto">
                      {leaderboard.map((item, index) => (
                          <li
                              key={item.id}
                              className={`flex items-center justify-between p-3 rounded-2xl border transition ${
                                  index === 0
                                      ? 'bg-amber-50 border-amber-200 shadow-sm'
                                      : index === 1
                                          ? 'bg-slate-50 border-slate-200'
                                          : index === 2
                                              ? 'bg-amber-50/40 border-amber-100'
                                              : 'bg-gray-50 border-gray-100'
                              }`}
                          >
                            <div className="flex items-center gap-3">
                      <span
                          className={`w-7 h-7 rounded-full flex items-center justify-center font-extrabold text-xs ${
                              index === 0
                                  ? 'bg-amber-400 text-white'
                                  : index === 1
                                      ? 'bg-slate-300 text-white'
                                      : index === 2
                                          ? 'bg-amber-600/70 text-white'
                                          : 'bg-gray-200 text-gray-600'
                          }`}
                      >
                        {index + 1}
                      </span>
                              <span className="font-bold text-gray-800 text-sm">{item.text}</span>
                            </div>

                            <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-xl shadow-xs border border-gray-100">
                              <Heart className="w-3.5 h-3.5 text-pink-500 fill-pink-500" />
                              <span className="text-xs font-bold text-gray-700">{item.likes}</span>
                            </div>
                          </li>
                      ))}
                    </ul>
                ) : (
                    <p className="text-center text-xs text-gray-400">Nessun nome ancora inserito.</p>
                )}
              </div>
          )}

          {/* Footer info */}
          <div className="text-center text-xs text-gray-400 pt-3 border-t border-gray-100">
            {phase === 2 && currentUser && (
                <span>Voti completati: <strong className="text-pink-500">{votedCount}</strong></span>
            )}
            {phase === 3 && (
                <span>Aggiornata in tempo reale ❤️</span>
            )}
          </div>

        </div>
      </main>
  );
}