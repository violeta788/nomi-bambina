'use client';

import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import TinderCard from 'react-tinder-card';
import { Heart, Plus, Trash2, ArrowRight, CheckCircle, HeartHandshake, Sparkles, Award, LogOut, AlertCircle, ChevronDown, ChevronUp, Users, X, Edit3 } from 'lucide-react';

export default function Home() {
  const [phase, setPhase] = useState(1); // 1 = Nomi, 2 = Swipe, 3 = Classifica, 4 = Match
  const [userName, setUserName] = useState('');
  const [isParentRole, setIsParentRole] = useState<'mom' | 'dad' | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Gestione Omonimia
  const [existingUserFound, setExistingUserFound] = useState<any>(null);

  // Modal Profilo / Dettagli Facoltativi
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isFirstLogin, setIsFirstLogin] = useState(false);
  const [profileNote, setProfileNote] = useState('');
  const [profileAvatar, setProfileAvatar] = useState('👶');

  const [currentInput, setCurrentInput] = useState('');
  const [names, setNames] = useState<any[]>([]);
  const [allNamesToVote, setAllNamesToVote] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [coupleMatches, setCoupleMatches] = useState<any[]>([]);
  const [expandedNameId, setExpandedNameId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [votedCount, setVotedCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [matchPopup, setMatchPopup] = useState<string | null>(null);

  const quickAvatarSuggestions = ['👶', '👵', '👴', '🎈', '⭐', '🌸', '👑', '🧸', '🚀', '🐱'];

  // Caricamento utente salvato
  useEffect(() => {
    const savedUser = localStorage.getItem('nomi_bambina_user');
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      setCurrentUser(parsed);
      setProfileNote(parsed.note || '');
      setProfileAvatar(parsed.avatar || '👶');
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

  // Carica Classifica con lista dei votanti (Fase 3)
  const fetchLeaderboard = async () => {
    setLoading(true);
    const { data: allNames } = await supabase.from('names').select('*');
    const { data: allVotes } = await supabase.from('votes').select('*').eq('is_liked', true);
    const { data: allUsers } = await supabase.from('users').select('*');

    if (allNames && allVotes && allUsers) {
      const usersMap = new Map(allUsers.map((u) => [u.id, u]));

      const scores = allNames.map((n) => {
        const nameLikes = allVotes.filter((v) => v.name_id === n.id);
        const voters = nameLikes.map((v) => usersMap.get(v.user_id)).filter(Boolean);

        return {
          id: n.id,
          text: n.name_text,
          likes: nameLikes.length,
          voters: voters,
        };
      });

      scores.sort((a, b) => b.likes - a.likes);
      setLeaderboard(scores);
    }
    setLoading(false);
  };

  // Carica i Match di Coppia (Fase 4)
  const fetchCoupleMatches = async () => {
    setLoading(true);

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
    setExpandedNameId(null);
    if (newPhase === 2) fetchAllNamesForVoting();
    if (newPhase === 3) fetchLeaderboard();
    if (newPhase === 4) fetchCoupleMatches();
  };

  // 1. Controllo Iniziale Accesso
  const handleCheckLogin = async (e: any) => {
    e.preventDefault();
    const cleanName = userName.trim();
    if (!cleanName) return;
    setLoading(true);
    setErrorMessage('');
    setExistingUserFound(null);

    const { data: existing } = await supabase
        .from('users')
        .select('*')
        .ilike('name', cleanName)
        .maybeSingle();

    if (existing) {
      setExistingUserFound(existing);
      setLoading(false);
    } else {
      createNewUser(cleanName, isParentRole || 'guest');
    }
  };

  // 2. Conferma Rientro Utente Esistente
  const handleConfirmExistingUser = () => {
    if (existingUserFound) {
      setCurrentUser(existingUserFound);
      setProfileNote(existingUserFound.note || '');
      setProfileAvatar(existingUserFound.avatar || '👶');
      localStorage.setItem('nomi_bambina_user', JSON.stringify(existingUserFound));
      fetchUserNames(existingUserFound.id);
      setExistingUserFound(null);
    }
  };

  // 3. Creazione Nuovo Utente
  const createNewUser = async (nameToCreate: string, roleToSet: string) => {
    setLoading(true);
    if (roleToSet === 'mom' || roleToSet === 'dad') {
      const { data: roleCheck } = await supabase
          .from('users')
          .select('*')
          .eq('role', roleToSet)
          .maybeSingle();

      if (roleCheck) {
        setErrorMessage(`Un profilo per la ${roleToSet === 'mom' ? 'Mamma' : 'Papà'} (${roleCheck.name}) esiste già!`);
        setLoading(false);
        return;
      }
    }

    const { data: newUser, error } = await supabase
        .from('users')
        .insert([{ name: nameToCreate, role: roleToSet, avatar: '👶' }])
        .select()
        .single();

    if (!error && newUser) {
      setCurrentUser(newUser);
      setProfileAvatar('👶');
      localStorage.setItem('nomi_bambina_user', JSON.stringify(newUser));
      fetchUserNames(newUser.id);
      setExistingUserFound(null);

      if (roleToSet === 'guest') {
        setIsFirstLogin(true);
        setShowProfileModal(true);
      }
    } else if (error) {
      setErrorMessage("Errore durante la registrazione. Riprova con un altro nome.");
    }
    setLoading(false);
  };

  // Salva Aggiornamenti Profilo (Corretto per evitare blocchi)
  const handleSaveProfile = async () => {
    if (!currentUser) return;
    setLoading(true);

    const cleanAvatar = profileAvatar.trim() || '👶';
    const updatedUserObj = {
      ...currentUser,
      note: profileNote,
      avatar: cleanAvatar
    };

    try {
      const { data: updated, error } = await supabase
          .from('users')
          .update({ note: profileNote, avatar: cleanAvatar })
          .eq('id', currentUser.id)
          .select()
          .single();

      if (updated && !error) {
        setCurrentUser(updated);
        localStorage.setItem('nomi_bambina_user', JSON.stringify(updated));
      } else {
        // Fallback in locale se la colonna database dà avviso
        setCurrentUser(updatedUserObj);
        localStorage.setItem('nomi_bambina_user', JSON.stringify(updatedUserObj));
      }
    } catch (err) {
      setCurrentUser(updatedUserObj);
      localStorage.setItem('nomi_bambina_user', JSON.stringify(updatedUserObj));
    } finally {
      setShowProfileModal(false);
      setIsFirstLogin(false);
      setLoading(false);
    }
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('nomi_bambina_user');
    setCurrentUser(null);
    setNames([]);
    setUserName('');
    setIsParentRole(null);
    setExistingUserFound(null);
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

  const toggleExpand = (id: string) => {
    setExpandedNameId(expandedNameId === id ? null : id);
  };

  const getRoleBadgeText = (user: any) => {
    if (!user) return '';
    if (user.role === 'mom') return '👩 Mamma';
    if (user.role === 'dad') return '👨 Papà';
    return user.note ? `${user.avatar || '👶'} ${user.note}` : null;
  };

  return (
      <main className="min-h-screen bg-gradient-to-b from-purple-100 via-purple-50 to-indigo-50 flex flex-col items-center justify-center p-4 select-none">
        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-2xl max-w-md w-full border border-purple-100 relative min-h-[540px] flex flex-col justify-between">

          {/* MODALE POPUP PROFILO FACOLTATIVO */}
          {showProfileModal && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-xs rounded-3xl z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl p-6 w-full shadow-2xl space-y-4 border border-purple-100 relative animate-fade-in">
                  <button
                      onClick={() => {
                        setShowProfileModal(false);
                        setIsFirstLogin(false);
                      }}
                      className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  <div className="text-center">
                    <div className="text-4xl mb-1">{profileAvatar || '👶'}</div>
                    <h3 className="font-bold text-gray-800 text-lg">
                      {isFirstLogin ? `Benvenuto/a ${currentUser?.name}! 🎉` : 'Il tuo Profilo'}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {isFirstLogin
                          ? 'Vuoi aggiungere chi sei per la bimba (es. Zia, Nonno, Amica) e scegliere la tua emoji?'
                          : 'Personalizza come ti vedono gli altri nella classifica!'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Relazione / Nota opzionale:
                    </label>
                    <input
                        type="text"
                        placeholder="Es. Zia, Amico, Nonna..."
                        value={profileNote}
                        onChange={(e) => setProfileNote(e.target.value)}
                        className="w-full px-3 py-2 text-sm text-gray-900 bg-white border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-300 focus:outline-none placeholder:text-gray-400"
                    />
                  </div>

                  {/* SELEZIONE EMOJI DA TASTIERA SMARTPHONE */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Scegli o digita la tua Emoji dalla tastiera:
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                          type="text"
                          maxLength={4}
                          placeholder="Scegli dalla tastiera 📱"
                          value={profileAvatar}
                          onChange={(e) => setProfileAvatar(e.target.value)}
                          className="w-full px-3 py-2 text-center text-xl text-gray-900 bg-white border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-300 focus:outline-none placeholder:text-gray-400"
                      />
                    </div>

                    <p className="text-[10px] text-gray-400 mb-1.5 text-center">Oppure tocca una di queste veloci:</p>
                    <div className="flex flex-wrap gap-1.5 justify-center">
                      {quickAvatarSuggestions.map((emoji) => (
                          <button
                              key={emoji}
                              type="button"
                              onClick={() => setProfileAvatar(emoji)}
                              className={`text-lg p-1.5 rounded-xl border transition ${
                                  profileAvatar === emoji
                                      ? 'bg-purple-100 border-purple-400 scale-110 shadow-xs'
                                      : 'bg-gray-50 border-gray-100 hover:bg-gray-100'
                              }`}
                          >
                            {emoji}
                          </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    <button
                        onClick={handleSaveProfile}
                        disabled={loading}
                        className="w-full bg-purple-600 text-white font-bold py-2.5 rounded-xl hover:bg-purple-700 transition text-sm shadow-sm"
                    >
                      {loading ? 'Salvataggio...' : 'Salva e Continua'}
                    </button>
                    {isFirstLogin && (
                        <button
                            type="button"
                            onClick={() => {
                              setShowProfileModal(false);
                              setIsFirstLogin(false);
                            }}
                            className="w-full text-xs text-gray-400 hover:text-gray-600 py-1 transition"
                        >
                          Salta per ora
                        </button>
                    )}
                  </div>
                </div>
              </div>
          )}

          {/* POPUP MATCH */}
          {matchPopup && (
              <div className="absolute inset-0 bg-purple-600/90 backdrop-blur-md rounded-3xl z-50 flex flex-col items-center justify-center text-white p-6 text-center animate-fade-in">
                <Sparkles className="w-16 h-16 mb-2 text-yellow-300 animate-bounce" />
                <h2 className="text-3xl font-extrabold mb-1">È UN MATCH! 💕</h2>
                <p className="text-sm text-purple-100 mb-4">Sia la Mamma che il Papà amano questo nome:</p>
                <div className="bg-white text-purple-700 px-6 py-3 rounded-2xl text-2xl font-black shadow-lg mb-6">
                  {matchPopup}
                </div>
                <button
                    onClick={() => setMatchPopup(null)}
                    className="bg-yellow-400 text-gray-900 font-bold px-6 py-2.5 rounded-xl hover:bg-yellow-300 transition shadow-md"
                >
                  Fantastico! 🎉
                </button>
              </div>
          )}

          {/* Intestazione */}
          <div>
            <div className="text-center mb-4 relative">
              <div className="bg-purple-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2">
                <Heart className="w-6 h-6 text-purple-600 fill-purple-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800">Scegliamo il Nome!</h1>

              {currentUser && (
                  <div className="flex flex-col items-center justify-center gap-1.5 mt-2">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-gray-700">
                        Ciao <span className="font-extrabold text-purple-700">{currentUser.name}</span>
                      </p>
                      <button
                          onClick={handleLogout}
                          title="Cambia Utente"
                          className="text-gray-400 hover:text-red-500 transition p-1"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                        onClick={() => {
                          setIsFirstLogin(false);
                          setShowProfileModal(true);
                        }}
                        className="inline-flex items-center gap-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs px-3 py-1 rounded-full border border-purple-200 transition font-medium shadow-2xs"
                    >
                      {getRoleBadgeText(currentUser) ? (
                          <>
                            <span>{getRoleBadgeText(currentUser)}</span>
                            <Edit3 className="w-3 h-3 text-purple-400 ml-0.5" />
                          </>
                      ) : (
                          <>
                            <Edit3 className="w-3.5 h-3.5 text-purple-600" />
                            <span className="font-semibold text-purple-700">✏️ Aggiungi chi sei</span>
                          </>
                      )}
                    </button>
                  </div>
              )}
            </div>

            {/* Navigazione Fasi */}
            {currentUser && (
                <div className="grid grid-cols-4 bg-purple-50 p-1 rounded-2xl mb-6 border border-purple-100 text-center gap-1">
                  <button
                      onClick={() => handleSwitchPhase(1)}
                      className={`py-2 text-[11px] font-bold rounded-xl transition ${
                          phase === 1 ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500'
                      }`}
                  >
                    1. Nomi
                  </button>
                  <button
                      onClick={() => handleSwitchPhase(2)}
                      className={`py-2 text-[11px] font-bold rounded-xl transition ${
                          phase === 2 ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500'
                      }`}
                  >
                    2. Swipe
                  </button>
                  <button
                      onClick={() => handleSwitchPhase(3)}
                      className={`py-2 text-[11px] font-bold rounded-xl transition ${
                          phase === 3 ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500'
                      }`}
                  >
                    3. Tutti
                  </button>
                  <button
                      onClick={() => handleSwitchPhase(4)}
                      className={`py-2 text-[11px] font-bold rounded-xl transition flex items-center justify-center gap-0.5 ${
                          phase === 4 ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500'
                      }`}
                  >
                    <Heart className="w-3 h-3 fill-purple-600 text-purple-600" /> Match
                  </button>
                </div>
            )}
          </div>

          {/* SCHERMATA LOGIN MINIMAL CON SUPPORTO OMONIMIA */}
          {!currentUser && (
              <div className="space-y-4 my-auto">
                {!existingUserFound ? (
                    <form onSubmit={handleCheckLogin} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Come ti chiami?
                        </label>
                        <input
                            type="text"
                            placeholder="Es. Marco, Elena..."
                            value={userName}
                            onChange={(e) => setUserName(e.target.value)}
                            className="w-full px-4 py-2 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-300 focus:outline-none text-gray-900 bg-white mb-3 placeholder:text-gray-400"
                            required
                        />

                        <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                          Sei uno dei genitori? (Opzionale)
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                              type="button"
                              onClick={() => setIsParentRole(isParentRole === 'mom' ? null : 'mom')}
                              className={`py-2 px-2 text-xs font-semibold rounded-xl border transition flex items-center justify-center gap-1.5 ${
                                  isParentRole === 'mom'
                                      ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                                      : 'bg-purple-50/50 text-gray-600 border-purple-100 hover:bg-purple-100/50'
                              }`}
                          >
                            <span>👩</span> Sono la Mamma
                          </button>
                          <button
                              type="button"
                              onClick={() => setIsParentRole(isParentRole === 'dad' ? null : 'dad')}
                              className={`py-2 px-2 text-xs font-semibold rounded-xl border transition flex items-center justify-center gap-1.5 ${
                                  isParentRole === 'dad'
                                      ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                                      : 'bg-purple-50/50 text-gray-600 border-purple-100 hover:bg-purple-100/50'
                              }`}
                          >
                            <span>👨</span> Sono il Papà
                          </button>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1.5 text-center">
                          * Necessario solo per attivare la funzione "Match di coppia"
                        </p>
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
                          className="w-full bg-purple-600 text-white font-semibold py-2.5 rounded-xl hover:bg-purple-700 transition flex items-center justify-center gap-2 shadow-sm"
                      >
                        {loading ? 'Verifica...' : 'Entra nell\'app'} <ArrowRight className="w-4 h-4" />
                      </button>
                    </form>
                ) : (
                    /* RISOLUZIONE OMONIMIA */
                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 space-y-3 animate-fade-in">
                      <div className="flex items-start gap-2 text-amber-800">
                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600" />
                        <div>
                          <h4 className="font-bold text-sm">Esiste già un "{userName}"!</h4>
                          <p className="text-xs text-amber-700 mt-0.5">
                            Sei già entrato in precedenza da questo dispositivo o da un altro?
                          </p>
                        </div>
                      </div>

                      <button
                          onClick={handleConfirmExistingUser}
                          className="w-full bg-amber-500 text-white font-bold py-2 rounded-xl hover:bg-amber-600 transition text-xs shadow-xs"
                      >
                        🔑 Sì, sono io! Rientra nel profilo
                      </button>

                      <div className="border-t border-amber-200/60 pt-2 text-center">
                        <p className="text-[11px] text-amber-800 mb-2">
                          Oppure sei un altro {userName}? Aggiungi un'iniziale (es. {userName} R.):
                        </p>
                        <div className="flex gap-2">
                          <input
                              type="text"
                              placeholder={`Es. ${userName} B.`}
                              onChange={(e) => setUserName(e.target.value)}
                              className="flex-1 px-3 py-1.5 border rounded-xl text-xs bg-white text-gray-900 focus:outline-none"
                          />
                          <button
                              onClick={() => createNewUser(userName, isParentRole || 'guest')}
                              className="bg-purple-600 text-white font-semibold px-3 py-1.5 rounded-xl text-xs hover:bg-purple-700 transition"
                          >
                            Crea
                          </button>
                        </div>
                      </div>
                    </div>
                )}
              </div>
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
                            className="flex-1 px-4 py-2 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-300 focus:outline-none text-gray-900 bg-white placeholder:text-gray-400"
                        />
                        <button
                            type="submit"
                            disabled={!currentInput.trim() || loading}
                            className="bg-purple-600 text-white p-2.5 rounded-xl hover:bg-purple-700 disabled:opacity-50"
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
                    <p className="text-center text-sm font-semibold text-emerald-600 bg-emerald-50 p-2 rounded-xl">
                      Hai raggiunto il limite di 10 nomi! 🎉
                    </p>
                )}

                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span>I tuoi nomi inseriti:</span>
                  <span className="font-bold text-purple-700">{names.length} / 10</span>
                </div>

                <ul className="space-y-2 max-h-48 overflow-y-auto">
                  {names.map((item) => (
                      <li
                          key={item.id}
                          className="flex items-center justify-between p-3 bg-purple-50/40 rounded-xl border border-purple-100"
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
                            <div className="w-full h-full bg-gradient-to-br from-purple-500 to-indigo-600 rounded-3xl shadow-xl flex flex-col items-center justify-center text-white p-6 cursor-grab active:cursor-grabbing border-4 border-white">
                              <HeartHandshake className="w-12 h-12 mb-3 text-purple-200" />
                              <h2 className="text-3xl font-extrabold tracking-wide drop-shadow-md">
                                {item.name_text}
                              </h2>
                              <div className="flex gap-8 mt-6 text-xs text-purple-100 font-medium">
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
                        Guarda la classifica o i Match per scoprire le preferenze!
                      </p>
                    </div>
                )}
              </div>
          )}

          {/* FASE 3: CLASSIFICA CON DETTAGLIO VOTI */}
          {currentUser && phase === 3 && (
              <div className="space-y-3 my-2 flex-1 flex flex-col justify-center">
                <h3 className="text-center font-bold text-gray-700 text-sm mb-1 flex items-center justify-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-500" /> Classifica Generale
                </h3>
                <p className="text-center text-[11px] text-gray-400 mb-2">
                  Clicca su un nome per vedere chi lo ha votato! 👆
                </p>

                {loading ? (
                    <p className="text-center text-gray-400 text-sm">Calcolo classifica...</p>
                ) : leaderboard.length > 0 ? (
                    <ul className="space-y-2 max-h-64 overflow-y-auto">
                      {leaderboard.map((item, index) => {
                        const isExpanded = expandedNameId === item.id;
                        return (
                            <li
                                key={item.id}
                                onClick={() => toggleExpand(item.id)}
                                className={`p-3 rounded-2xl border transition cursor-pointer ${
                                    index === 0
                                        ? 'bg-amber-50 border-amber-200'
                                        : 'bg-purple-50/30 border-purple-100 hover:bg-purple-50/70'
                                }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                          <span className="font-extrabold text-xs text-gray-400 w-4">
                            {index + 1}.
                          </span>
                                  <span className="font-bold text-gray-800 text-sm">{item.text}</span>
                                </div>

                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-xl border border-purple-100 shadow-xs">
                                    <Heart className="w-3.5 h-3.5 text-purple-600 fill-purple-600" />
                                    <span className="text-xs font-bold text-gray-700">{item.likes}</span>
                                  </div>
                                  {isExpanded ? (
                                      <ChevronUp className="w-4 h-4 text-gray-400" />
                                  ) : (
                                      <ChevronDown className="w-4 h-4 text-gray-400" />
                                  )}
                                </div>
                              </div>

                              {/* DETTAGLIO VOTANTI */}
                              {isExpanded && (
                                  <div className="mt-2.5 pt-2 border-t border-purple-100 text-xs animate-fade-in">
                                    <p className="text-[11px] font-semibold text-gray-500 mb-1.5 flex items-center gap-1">
                                      <Users className="w-3 h-3 text-purple-600" /> Piace a:
                                    </p>
                                    {item.voters.length > 0 ? (
                                        <div className="flex flex-wrap gap-1.5">
                                          {item.voters.map((voter: any) => (
                                              <span
                                                  key={voter.id}
                                                  className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded-lg border border-purple-200 text-gray-700 font-medium text-[11px]"
                                              >
                                  <span>{voter.name}</span>
                                  <span className="text-[10px] text-gray-400">
                                    ({getRoleBadgeText(voter) || `${voter.avatar || '👶'} Partecipante`})
                                  </span>
                                </span>
                                          ))}
                                        </div>
                                    ) : (
                                        <p className="text-gray-400 text-[11px] italic">Nessun voto ricevuto finora.</p>
                                    )}
                                  </div>
                              )}
                            </li>
                        );
                      })}
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
                  <Sparkles className="w-4 h-4 text-purple-600" /> Match Mamma & Papà 💕
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
                              className="flex items-center justify-between p-3.5 bg-purple-50 rounded-2xl border border-purple-200 shadow-xs"
                          >
                            <span className="font-extrabold text-purple-800 text-base">{item.name_text}</span>
                            <span className="text-xs bg-purple-600 text-white px-2.5 py-1 rounded-xl font-bold flex items-center gap-1">
                      👩‍❤️‍👨 Intesa Perfetta
                    </span>
                          </li>
                      ))}
                    </ul>
                ) : (
                    <div className="text-center py-6 bg-purple-50/30 rounded-2xl border border-dashed border-purple-200 p-4">
                      <Heart className="w-8 h-8 text-purple-300 mx-auto mb-2" />
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
                <span>Voti completati: <strong className="text-purple-600">{votedCount}</strong></span>
            )}
            {(phase === 3 || phase === 4) && (
                <span>Aggiornato in tempo reale ❤️</span>
            )}
          </div>

        </div>
      </main>
  );
}