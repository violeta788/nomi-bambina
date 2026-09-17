'use client';

import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import TinderCard from 'react-tinder-card';
import { Heart, Plus, Trash2, ArrowRight, CheckCircle, HeartHandshake, Sparkles, Trophy, Award, LogOut, AlertCircle, HeartHandshake as MatchIcon, Users } from 'lucide-react';

export default function Home() {
  const [phase, setPhase] = useState(1); // 1 = Nomi, 2 = Swipe, 3 = Classifica, 4 = Match
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState<'mom' | 'dad' | 'guest'>('guest');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentInput, setCurrentInput] = useState('');
  const [names, setNames] = useState<any[]>([]);
  const [allNamesToVote, setAllNamesToVote] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [coupleMatches, setCoupleMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [votedCount, setVotedCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [matchPopup, setMatchPopup] = useState<string | null>(null);

  // Caricamento utente salvato
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

  // Carica i nomi per lo Swipe (Fase 2)
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

  // Carica Classifica (Fase 3)
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

  // Carica i Match di Coppia (Fase 4)
  const fetchCoupleMatches = async () => {
    setLoading(true);

    // Recupera Mamma e Papà
    const { data: parents } = await supabase
        .from('users')
        .select('*')
        .in('role', ['mom', 'dad']);

    const mom = parents?.find((p) => p.role === 'mom');
    const dad = parents?.find((p) => p.role === 'dad');

    if (mom && dad) {
      const { data: momVotes } = await supabase.from('votes').select('name_id').eq('user_id', mom.id).eq('is_liked', true);
      const { data: dadVotes } = await supabase.from('votes').select('name_id').eq('user_id', dad.id).eq('is_liked', true);

      const momLikedIds = momVotes ? momVotes.map((v) => v.name_id) : [];
      const dadLikedIds = dadVotes ? dadVotes.map((v) => v.name_id) : [];

      const matchedIds = momLikedIds.filter((id) => dadLikedIds.includes(id));

      if (matchedIds.length > 0) {
        const { data: matchedNames } = await supabase.from('names').select('*').in('id', matchedIds);
        setCoupleMatches(matchedNames || []);
      } else {
        setCoupleMatches([]);
      }
    } else {
      setCoupleMatches([]);
    }
    setLoading(false);
  };

  // Cambio Fase
  const handleSwitchPhase = (newPhase: any) => {
    setPhase(newPhase);
    setErrorMessage('');
    if (newPhase === 2) fetchAllNamesForVoting();
    if (newPhase === 3) fetchLeaderboard();
    if (newPhase === 4) fetchCoupleMatches();
  };

  // Login / Registrazione
  const handleLogin = async (e: any) => {
    e.preventDefault();
    const cleanName = userName.trim();
    if (!cleanName) return;
    setLoading(true);
    setErrorMessage('');

    // Verifica se esiste l'utente
    const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .ilike('name', cleanName)
        .maybeSingle();

    if (existingUser) {
      setCurrentUser(existingUser);
      localStorage.setItem('nomi_bambina_user', JSON.stringify(existingUser));
      fetchUserNames(existingUser.id);
    } else {
      // Se sceglie Mamma/Papà, verifica che non ce ne sia già uno registrato
      if (userRole === 'mom' || userRole === 'dad') {
        const { data: roleCheck } = await supabase
            .from('users')
            .select('*')
            .eq('role', userRole)
            .maybeSingle();

        if (roleCheck) {
          setErrorMessage(`Un account per la ${userRole === 'mom' ? 'Mamma' : 'Papà'} (${roleCheck.name}) esiste già!`);
          setLoading(false);
          return;
        }
      }

      const { data: newUser, error } = await supabase
          .from('users')
          .insert([{ name: cleanName, role: userRole }])
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
    setUserRole('guest');
    setPhase(1);
    setErrorMessage('');
  };

  // Inserimento nome
  const handleAddName = async (e: any) => {
    e.preventDefault();
    const cleanName = currentInput.trim();
    setErrorMessage('');

    if (!cleanName || !currentUser) return;

    if (names.length >= 10) {
      setErrorMessage('Hai raggiunto il massimo di 10 nomi!');
      return;
    }

    setLoading(true);

    const { data: existingName } = await supabase
        .from('names')
        .select('name_text')
        .ilike('name_text', cleanName)
        .maybeSingle();

    if (existingName) {
      setErrorMessage(`Il nome "${cleanName}" è già presente!`);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
        .from('names')
        .insert([{ user_id: currentUser.id, name_text: cleanName }])
        .select()
        .single();

    if (data && !error) {
      setNames([...names, data]);
      setCurrentInput('');
    }
    setLoading(false);
  };

  // Cancellazione nome
  const handleRemoveName = async (idToRemove: any) => {
    setLoading(true);
    setErrorMessage('');
    const { error } = await supabase.from('names').delete().eq('id', idToRemove);
    if (!error) {
      setNames(names.filter((n) => n.id !== idToRemove));
    }
    setLoading(false);
  };

  // Swipe Tinder con rilevamento Match
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

    // Controlla se è un Match tra Mamma e Papà
    if (isLiked && (currentUser.role === 'mom' || currentUser.role === 'dad')) {
      const otherRole = currentUser.role === 'mom' ? 'dad' : 'mom';

      const { data: otherParent } = await supabase
          .from('users')
          .select('id')
          .eq('role', otherRole)
          .maybeSingle();

      if (otherParent) {
        const { data: otherVote } = await supabase
            .from('votes')
            .select('*')
            .eq('user_id', otherParent.id)
            .eq('name_id', nameItem.id)
            .eq('is_liked', true)
            .maybeSingle();

        if (otherVote) {
          setMatchPopup(nameItem.name_text);
        }
      }
    }

    setAllNamesToVote((prev) => prev.filter((item) => item.id !== nameItem.id));
    setVotedCount((prev) => prev + 1);
  };

  return (
      <main className="min-h-screen bg-gradient-to-b from-pink-100 to-pink-50 flex flex-col items-center justify-center p-4 select-none">
        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-2xl max-w-md w-full border border-pink-100 relative min-h-[540px] flex flex-col justify-between">

          {/* POPUP E UN MATCH! */}
          {matchPopup && (
              <div className="absolute inset-0 bg-pink-500/90 backdrop-blur-md rounded-3xl z-50 flex flex-col items-center justify-center text-white p-6 text-center animate-fade-in">
                <Sparkles className="w-16 h-16 mb-2 text-yellow-300 animate-bounce" />
                <h2 className="text-3xl font-extrabold mb-1">È UN MATCH! 💕</h2>
                <p className="text-sm text-pink-100 mb-4">Sia la Mamma che il Papà amano questo nome:</p>
                <div className="bg-white text-pink-600 px-6 py-3 rounded-2xl text-2xl font-black shadow-lg mb-6">
                  {matchPopup}
                </div>
                <button
                    onClick={() => setMatchPopup(null)}
                    className="bg-yellow-400 text-gray-900 font-bold px-6 py-2.5 rounded-xl hover:bg-yellow-300 transition"
                >
                  Fantastico! 🎉
                </button>
              </div>
          )}

          {/* Intestazione */}
          <div>
            <div className="text-center mb-4 relative">
              <div className="bg-pink-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2">
                <Heart className="w-6 h-6 text-pink-500 fill-pink-500" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800">Scegliamo il Nome!</h1>

              {currentUser && (
                  <div className="flex items-center justify-center gap-2 mt-1">
                <span className="text-xs bg-pink-50 text-pink-700 px-2.5 py-0.5 rounded-full border border-pink-200 font-medium">
                  {currentUser.role === 'mom' ? '👩 Mamma' : currentUser.role === 'dad' ? '👨 Papà' : '🏼 Parenti & Amici'}
                </span>
                    <p className="text-xs text-gray-500">
                      <span className="font-bold text-pink-600">{currentUser.name}</span>
                    </p>
                    <button
                        onClick={handleLogout}
                        title="Cambia Utente"
                        className="text-gray-400 hover:text-red-500 transition p-1 ml-1"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  </div>
              )}
            </div>

            {/* Navigazione Fasi */}
            {currentUser && (
                <div className="grid grid-cols-4 bg-pink-50 p-1 rounded-2xl mb-6 border border-pink-100 text-center gap-1">
                  <button
                      onClick={() => handleSwitchPhase(1)}
                      className={`py-2 text-[11px] font-bold rounded-xl transition ${
                          phase === 1 ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-500'
                      }`}
                  >
                    1. Nomi
                  </button>
                  <button
                      onClick={() => handleSwitchPhase(2)}
                      className={`py-2 text-[11px] font-bold rounded-xl transition ${
                          phase === 2 ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-500'
                      }`}
                  >
                    2. Swipe
                  </button>
                  <button
                      onClick={() => handleSwitchPhase(3)}
                      className={`py-2 text-[11px] font-bold rounded-xl transition ${
                          phase === 3 ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-500'
                      }`}
                  >
                    3. Tutti
                  </button>
                  <button
                      onClick={() => handleSwitchPhase(4)}
                      className={`py-2 text-[11px] font-bold rounded-xl transition flex items-center justify-center gap-0.5 ${
                          phase === 4 ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-500'
                      }`}
                  >
                    <Heart className="w-3 h-3 fill-pink-500 text-pink-500" /> Match
                  </button>
                </div>
            )}
          </div>

          {/* SCHERMATA LOGIN CON RUOLO */}
          {!currentUser && (
              <form onSubmit={handleLogin} className="space-y-4 my-auto">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Come ti chiami?
                  </label>
                  <input
                      type="text"
                      placeholder="Es. Marco"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-pink-300 focus:outline-none text-gray-800 mb-3"
                      required
                  />

                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Chi sei per la bimba?
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                        type="button"
                        onClick={() => setUserRole('mom')}
                        className={`py-2 px-1 text-xs font-semibold rounded-xl border transition flex flex-col items-center gap-1 ${
                            userRole === 'mom'
                                ? 'bg-pink-500 text-white border-pink-500 shadow-sm'
                                : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                        }`}
                    >
                      <span className="text-base">👩</span> Mamma
                    </button>
                    <button
                        type="button"
                        onClick={() => setUserRole('dad')}
                        className={`py-2 px-1 text-xs font-semibold rounded-xl border transition flex flex-col items-center gap-1 ${
                            userRole === 'dad'
                                ? 'bg-pink-500 text-white border-pink-500 shadow-sm'
                                : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                        }`}
                    >
                      <span className="text-base">👨</span> Papà
                    </button>
                    <button
                        type="button"
                        onClick={() => setUserRole('guest')}
                        className={`py-2 px-1 text-xs font-semibold rounded-xl border transition flex flex-col items-center gap-1 ${
                            userRole === 'guest'
                                ? 'bg-pink-500 text-white border-pink-500 shadow-sm'
                                : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                        }`}
                    >
                      <span className="text-base">👶</span> Parente/Amico
                    </button>
                  </div>
                </div>

                {errorMessage && (
                    <div className="flex items-center gap-1.5 p-2.5 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-pink-500 text-white font-semibold py-2.5 rounded-xl hover:bg-pink-600 transition flex items-center justify-center gap-2"
                >
                  {loading ? 'Verifica...' : 'Entra o Registrati'} <ArrowRight className="w-4 h-4" />
                </button>
              </form>
          )}

          {/* FASE 1: INSERIMENTO NOMI */}
          {currentUser && phase === 1 && (
              <div className="space-y-4 my-auto">
                {names.length < 10 ? (
                    <form onSubmit={handleAddName} className="space-y-2">
                      <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Scrivi un nome..."
                            value={currentInput}
                            onChange={(e) => {
                              setCurrentInput(e.target.value);
                              if (errorMessage) setErrorMessage('');
                            }}
                            className="flex-1 px-4 py-2 border rounded-xl focus:ring-2 focus:ring-pink-300 focus:outline-none text-gray-800"
                        />
                        <button
                            type="submit"
                            disabled={!currentInput.trim() || loading}
                            className="bg-pink-500 text-white p-2.5 rounded-xl hover:bg-pink-600 disabled:opacity-50"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>

                      {errorMessage && (
                          <div className="flex items-center gap-1.5 p-2.5 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            <span>{errorMessage}</span>
                          </div>
                      )}
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
                    <p className="text-gray-400 text-sm">Caricamento...</p>
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
                        Guarda i **Match Mamma & Papà** nel tab dedicato!
                      </p>
                    </div>
                )}
              </div>
          )}

          {/* FASE 3: CLASSIFICA GENERALE */}
          {currentUser && phase === 3 && (
              <div className="space-y-3 my-2 flex-1 flex flex-col justify-center">
                <h3 className="text-center font-bold text-gray-700 text-sm mb-2 flex items-center justify-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-500" /> Classifica Tutti gli Utenti
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
                                      ? 'bg-amber-50 border-amber-200'
                                      : 'bg-gray-50 border-gray-100'
                              }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-extrabold text-xs text-gray-500 w-5">{index + 1}.</span>
                              <span className="font-bold text-gray-800 text-sm">{item.text}</span>
                            </div>

                            <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-xl border border-gray-100">
                              <Heart className="w-3.5 h-3.5 text-pink-500 fill-pink-500" />
                              <span className="text-xs font-bold text-gray-700">{item.likes}</span>
                            </div>
                          </li>
                      ))}
                    </ul>
                ) : (
                    <p className="text-center text-xs text-gray-400">Nessun nome inserito.</p>
                )}
              </div>
          )}

          {/* FASE 4: MATCH MAMMA & PAPÀ */}
          {currentUser && phase === 4 && (
              <div className="space-y-3 my-2 flex-1 flex flex-col justify-center">
                <h3 className="text-center font-bold text-gray-800 text-sm mb-1 flex items-center justify-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-pink-500" /> Match Mamma & Papà 💕
                </h3>
                <p className="text-center text-xs text-gray-400 mb-3">
                  Nomi approvati da entrambi i genitori
                </p>

                {loading ? (
                    <p className="text-center text-gray-400 text-sm">Ricerca dei match...</p>
                ) : coupleMatches.length > 0 ? (
                    <ul className="space-y-2 max-h-64 overflow-y-auto">
                      {coupleMatches.map((item) => (
                          <li
                              key={item.id}
                              className="flex items-center justify-between p-3.5 bg-pink-50 rounded-2xl border border-pink-200 shadow-xs"
                          >
                            <span className="font-extrabold text-pink-700 text-base">{item.name_text}</span>
                            <span className="text-xs bg-pink-500 text-white px-2.5 py-1 rounded-xl font-bold flex items-center gap-1">
                      👩‍❤️‍👨 Intesa Perfetta
                    </span>
                          </li>
                      ))}
                    </ul>
                ) : (
                    <div className="text-center py-6 bg-gray-50 rounded-2xl border border-dashed border-gray-200 p-4">
                      <Heart className="w-8 h-8 text-pink-300 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-gray-600">Nessun Match di coppia ancora!</p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        Mamma e Papà devono registrarsi con i rispettivi ruoli ed effettuare lo Swipe!
                      </p>
                    </div>
                )}
              </div>
          )}

          {/* Footer info */}
          <div className="text-center text-xs text-gray-400 pt-3 border-t border-gray-100">
            {phase === 2 && currentUser && (
                <span>Voti completati: <strong className="text-pink-500">{votedCount}</strong></span>
            )}
            {(phase === 3 || phase === 4) && (
                <span>Aggiornato in tempo reale ❤️</span>
            )}
          </div>

        </div>
      </main>
  );
}