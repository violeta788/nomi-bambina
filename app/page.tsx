'use client';

import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { namesDatabase } from '../data/namesData';
import TinderCard from 'react-tinder-card';
import { Heart, Plus, Trash2, ArrowRight, CheckCircle, HeartHandshake, Sparkles, Award, LogOut, AlertCircle, Users, X, Edit3, Zap, BookOpen } from 'lucide-react';

export default function Home() {
  const [myVotesList, setMyVotesList] = useState<any[]>([]);
  const [lastVotedItem, setLastVotedItem] = useState<{ nameItem: any; voteId: string } | null>(null);
  const [phase, setPhase] = useState(1); // 1 = Nomi, 2 = Swipe, 3 = Classifica, 4 = Match & Affinità, 5 = Miei Voti
  const [userName, setUserName] = useState('');
  const [isParentRole, setIsParentRole] = useState<'mom' | 'dad' | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Preferenza Inversione Swipe per singolo dispositivo
  const [invertSwipe, setInvertSwipe] = useState(false);

  // Gestione Omonimia
  const [existingUserFound, setExistingUserFound] = useState<any>(null);

  // Modal Profilo / Dettagli Facoltativi
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isFirstLogin, setIsFirstLogin] = useState(false);
  const [profileNote, setProfileNote] = useState('');
  const [profileAvatar, setProfileAvatar] = useState('👶');

  // Modale Dettaglio Nome (Significato & Onomastico)
  const [selectedNameDetail, setSelectedNameDetail] = useState<any>(null);

  const [currentInput, setCurrentInput] = useState('');
  const [names, setNames] = useState<any[]>([]);
  const [allNamesToVote, setAllNamesToVote] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  // Stato Match e Affinità
  const [coupleMatches, setCoupleMatches] = useState<any[]>([]);
  const [groupMatches, setGroupMatches] = useState<any[]>([]);
  const [topAffinityUser, setTopAffinityUser] = useState<{ user: any; count: number } | null>(null);

  const [loading, setLoading] = useState(false);
  const [votedCount, setVotedCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  // Pop-up Intesa durante lo Swipe
  const [matchPopup, setMatchPopup] = useState<{ title: string; subtitle: string; name: string } | null>(null);

  const quickAvatarSuggestions = ['👶', '👩', '👨', '👵', '👴', '🎈', '⭐', '🌸', '👑', '🧸', '🚀', '🐱'];

  // Caricamento utente salvato e preferenza swipe
  useEffect(() => {
    const savedInvert = localStorage.getItem('nomi_bambina_invert_swipe');
    if (savedInvert) {
      setInvertSwipe(JSON.parse(savedInvert));
    }

    const savedUser = localStorage.getItem('nomi_bambina_user');
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      setCurrentUser(parsed);
      setProfileNote(parsed.note || '');
      setProfileAvatar(parsed.avatar || (parsed.role === 'mom' ? '👩' : parsed.role === 'dad' ? '👨' : '👶'));
      fetchUserNames(parsed.id);
    }
  }, []);

  const handleToggleInvert = (value: boolean) => {
    setInvertSwipe(value);
    localStorage.setItem('nomi_bambina_invert_swipe', JSON.stringify(value));
  };

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

  // Carica i voti personali dell'utente (Fase 5)
  const fetchMyVotes = async () => {
    if (!currentUser) return;
    setLoading(true);

    const { data, error } = await supabase
        .from('votes')
        .select(`
          id,
          is_liked,
          created_at,
          names (
            id,
            name_text
          )
        `)
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    if (!error && data) {
      setMyVotesList(data);
    }
    setLoading(false);
  };

  // Elimina un voto dal registro personale
  const handleDeleteVote = async (voteId: string) => {
    setLoading(true);
    const { error } = await supabase
        .from('votes')
        .delete()
        .eq('id', voteId);

    if (!error) {
      setMyVotesList((prev) => prev.filter((v) => v.id !== voteId));
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

  // Carica Match di Coppia e Intesa di Gruppo (Fase 4)
  const fetchCoupleMatches = async () => {
    setLoading(true);

    const { data: allNames } = await supabase.from('names').select('*');
    const { data: allVotes } = await supabase.from('votes').select('*').eq('is_liked', true);
    const { data: allUsers } = await supabase.from('users').select('*');

    if (!allNames || !allVotes || !allUsers) {
      setLoading(false);
      return;
    }

    const usersMap = new Map(allUsers.map((u) => [u.id, u]));

    // 1. Match Mamma & Papà
    const mom = allUsers.find((p) => p.role === 'mom');
    const dad = allUsers.find((p) => p.role === 'dad');

    if (mom && dad) {
      const momLikedIds = allVotes.filter((v) => v.user_id === mom.id).map((v) => v.name_id);
      const dadLikedIds = allVotes.filter((v) => v.user_id === dad.id).map((v) => v.name_id);
      const matchedIds = momLikedIds.filter((id) => dadLikedIds.includes(id));
      const matchedNames = allNames.filter((n) => matchedIds.includes(n.id));
      setCoupleMatches(matchedNames);
    } else {
      setCoupleMatches([]);
    }

    // 2. Nomi con almeno 2 voti positivi nel gruppo
    const groupScores = allNames.map((n) => {
      const nameLikes = allVotes.filter((v) => v.name_id === n.id);
      const voters = nameLikes.map((v) => usersMap.get(v.user_id)).filter(Boolean);

      return {
        id: n.id,
        text: n.name_text,
        likes: nameLikes.length,
        voters: voters,
      };
    }).filter((item) => item.likes >= 2);

    groupScores.sort((a, b) => b.likes - a.likes);
    setGroupMatches(groupScores);

    // 3. Calcolo Affinità Maggiore per l'utente corrente
    if (currentUser) {
      const myLikedNameIds = allVotes.filter((v) => v.user_id === currentUser.id).map((v) => v.name_id);

      const affinityMap = new Map<string, number>();
      allVotes.forEach((v) => {
        if (v.user_id !== currentUser.id && myLikedNameIds.includes(v.name_id)) {
          affinityMap.set(v.user_id, (affinityMap.get(v.user_id) || 0) + 1);
        }
      });

      let maxCount = 0;
      let topUserId: string | null = null;

      affinityMap.forEach((count, userId) => {
        if (count > maxCount) {
          maxCount = count;
          topUserId = userId;
        }
      });

      if (topUserId && maxCount > 0) {
        setTopAffinityUser({
          user: usersMap.get(topUserId),
          count: maxCount,
        });
      } else {
        setTopAffinityUser(null);
      }
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
    if (newPhase === 5) fetchMyVotes();
  };

  // Logica Ibrida: Database Locale + Fallback Intelligente
  const getSmartNameDetails = (nameText: string) => {
    if (!nameText) return { meaning: "Un nome speciale pieno di dolcezza.", onomastico: "1 Novembre (Ognissanti)" };

    const clean = nameText.trim().toLowerCase();

    // 1. Controllo nel database locale ad alte prestazioni
    if (namesDatabase[clean]) {
      return namesDatabase[clean];
    }

    // 2. Fallback intelligente per nomi fuori catalogo o inventati
    const firstLetter = nameText.charAt(0).toUpperCase();
    return {
      meaning: `Un nome unico ed esclusivo che inizia con la lettera ${firstLetter}, scelto appositamente per questa splendida avventura.`,
      onomastico: "1 Novembre (Ognissanti)"
    };
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
      setProfileAvatar(existingUserFound.avatar || (existingUserFound.role === 'mom' ? '👩' : existingUserFound.role === 'dad' ? '👨' : '👶'));
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

    const initialAvatar = roleToSet === 'mom' ? '👩' : roleToSet === 'dad' ? '👨' : '👶';
    const initialNote = roleToSet === 'mom' ? 'Mamma' : roleToSet === 'dad' ? 'Papà' : '';

    const { data: newUser, error } = await supabase
        .from('users')
        .insert([{ name: nameToCreate, role: roleToSet, avatar: initialAvatar, note: initialNote }])
        .select()
        .single();

    if (!error && newUser) {
      setCurrentUser(newUser);
      setProfileAvatar(initialAvatar);
      setProfileNote(initialNote);
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

  // Salva Aggiornamenti Profilo
  const handleSaveProfile = async () => {
    if (!currentUser) return;
    setLoading(true);

    const cleanAvatar = profileAvatar.trim() || (currentUser.role === 'mom' ? '👩' : currentUser.role === 'dad' ? '👨' : '👶');
    const cleanNote = profileNote.trim();

    const updatedUserObj = {
      ...currentUser,
      note: cleanNote,
      avatar: cleanAvatar
    };

    try {
      const { data: updated, error } = await supabase
          .from('users')
          .update({ note: cleanNote, avatar: cleanAvatar })
          .eq('id', currentUser.id)
          .select()
          .single();

      if (updated && !error) {
        setCurrentUser(updated);
        localStorage.setItem('nomi_bambina_user', JSON.stringify(updated));
      } else {
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
    setProfileNote('');
    setProfileAvatar('👶');
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

  // SWIPE TINDER CON SUPPORTO ALL'INVERSIONE DEL DISPOSITIVO
  const handleSwiped = async (direction: any, nameItem: any) => {
    const isLiked = invertSwipe ? direction === 'left' : direction === 'right';
    if (!currentUser) return;

    const { data: insertedVote, error } = await supabase.from('votes').insert([
      {
        user_id: currentUser.id,
        name_id: nameItem.id,
        is_liked: isLiked,
      },
    ]).select().single();

    if (!error && insertedVote) {
      setLastVotedItem({ nameItem, voteId: insertedVote.id });
    }

    if (isLiked) {
      const { data: otherVotes } = await supabase
          .from('votes')
          .select('*')
          .eq('name_id', nameItem.id)
          .eq('is_liked', true)
          .neq('user_id', currentUser.id);

      if (otherVotes && otherVotes.length > 0) {
        const { data: otherUsers } = await supabase
            .from('users')
            .select('*')
            .in('id', otherVotes.map((v) => v.user_id));

        if (otherUsers && otherUsers.length > 0) {
          const partnerRole = currentUser.role === 'mom' ? 'dad' : currentUser.role === 'dad' ? 'mom' : null;
          const partner = partnerRole ? otherUsers.find((u) => u.role === partnerRole) : null;

          if (partner) {
            setMatchPopup({
              title: 'MATCH DI COPPIA! 👩‍❤️‍👨',
              subtitle: 'Sia la Mamma che il Papà amano questo nome:',
              name: nameItem.name_text,
            });
          } else {
            const firstOther = otherUsers[0];
            const badgeText = getRoleBadgeText(firstOther);
            setMatchPopup({
              title: 'SUPER INTESA! 🎉',
              subtitle: `A te e a ${firstOther.name} (${badgeText}) piace:`,
              name: nameItem.name_text,
            });
          }
        }
      }
    }

    setAllNamesToVote((prev) => prev.filter((item) => item.id !== nameItem.id));
    setVotedCount((prev) => prev + 1);
  };

  const handleUndoLastVote = async () => {
    if (!lastVotedItem || !currentUser) return;
    setLoading(true);

    const { error } = await supabase
        .from('votes')
        .delete()
        .eq('id', lastVotedItem.voteId);

    if (!error) {
      setAllNamesToVote((prev) => [lastVotedItem.nameItem, ...prev]);
      setVotedCount((prev) => Math.max(0, prev - 1));
      setLastVotedItem(null);
    }
    setLoading(false);
  };

  const getRoleBadgeText = (user: any) => {
    if (!user) return '';
    const avatarEmoji = user.avatar || (user.role === 'mom' ? '👩' : user.role === 'dad' ? '👨' : '👶');

    if (user.role === 'mom') {
      return `${avatarEmoji} ${user.note || 'Mamma'}`;
    }
    if (user.role === 'dad') {
      return `${avatarEmoji} ${user.note || 'Papà'}`;
    }
    return user.note ? `${avatarEmoji} ${user.note}` : `${avatarEmoji} Partecipante`;
  };

  return (
      <main className="min-h-screen bg-gradient-to-b from-purple-100 via-purple-50 to-indigo-50 flex flex-col items-center justify-center p-4 select-none">
        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-2xl max-w-md w-full border border-purple-100 relative min-h-[540px] flex flex-col justify-between">

          {/* MODALE SIGNIFICATO & ONOMASTICO */}
          {selectedNameDetail && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-xs rounded-3xl z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl p-6 w-full shadow-2xl space-y-4 border border-purple-100 relative animate-fade-in max-h-[90%] overflow-y-auto">
                  <button
                      onClick={() => setSelectedNameDetail(null)}
                      className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  <div className="text-center">
                <span className="bg-purple-100 text-purple-700 text-xs font-bold px-3 py-1 rounded-full">
                  ✨ Carta d'Identità del Nome
                </span>
                    <h3 className="text-2xl font-black text-gray-800 mt-2">
                      {selectedNameDetail.text}
                    </h3>
                  </div>

                  {/* SIGNIFICATO */}
                  <div className="p-3 bg-purple-50/70 rounded-xl border border-purple-100 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-purple-800">
                      <BookOpen className="w-4 h-4 text-purple-600" /> Significato Originale
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed">
                      {getSmartNameDetails(selectedNameDetail.text).meaning}
                    </p>
                  </div>

                  {/* ONOMASTICO */}
                  <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-100 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-800">
                      <Sparkles className="w-4 h-4 text-indigo-600" /> Onomastico
                    </div>
                    <p className="text-xs text-gray-700 font-medium">
                      {getSmartNameDetails(selectedNameDetail.text).onomastico}
                    </p>
                  </div>

                  <button
                      onClick={() => setSelectedNameDetail(null)}
                      className="w-full bg-purple-600 text-white font-bold py-2.5 rounded-xl hover:bg-purple-700 transition text-sm shadow-sm mt-2"
                  >
                    Chiudi
                  </button>
                </div>
              </div>
          )}

          {/* MODALE POPUP PROFILO */}
          {showProfileModal && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-xs rounded-3xl z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl p-6 w-full shadow-2xl space-y-4 border border-purple-100 relative animate-fade-in max-h-[90%] overflow-y-auto">
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

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Scegli o digita la tua Emoji dalla tastiera:
                    </label>
                    <input
                        type="text"
                        placeholder="Scegli dalla tastiera 📱"
                        value={profileAvatar}
                        onChange={(e) => setProfileAvatar(e.target.value)}
                        className="w-full px-3 py-2 text-center text-xl text-gray-900 bg-white border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-300 focus:outline-none mb-2"
                    />
                    <div className="flex flex-wrap gap-1.5 justify-center">
                      {quickAvatarSuggestions.map((emoji) => (
                          <button
                              key={emoji}
                              type="button"
                              onClick={() => setProfileAvatar(emoji)}
                              className={`text-lg p-1.5 rounded-xl border transition ${
                                  profileAvatar === emoji ? 'bg-purple-100 border-purple-400 scale-110' : 'bg-gray-50 border-gray-100'
                              }`}
                          >
                            {emoji}
                          </button>
                      ))}
                    </div>
                  </div>

                  {/* OPZIONE INVERSIONE SWIPE PER DISPOSITIVO */}
                  <div className="pt-3 border-t border-purple-100 flex items-center justify-between">
                    <div>
                      <label className="text-xs font-bold text-gray-700 block">
                        Inverti Swipe per questo telefono
                      </label>
                      <p className="text-[10px] text-gray-400">
                        Attivalo se i comandi risultano specchiati
                      </p>
                    </div>
                    <input
                        type="checkbox"
                        checked={invertSwipe}
                        onChange={(e) => handleToggleInvert(e.target.checked)}
                        className="w-5 h-5 text-purple-600 rounded accent-purple-600 cursor-pointer"
                    />
                  </div>

                  <button
                      onClick={handleSaveProfile}
                      disabled={loading}
                      className="w-full bg-purple-600 text-white font-bold py-2.5 rounded-xl hover:bg-purple-700 transition text-sm shadow-sm mt-2"
                  >
                    {loading ? 'Salvataggio...' : 'Salva e Continua'}
                  </button>
                </div>
              </div>
          )}

          {/* POPUP MATCH */}
          {matchPopup && (
              <div className="absolute inset-0 bg-purple-600/90 backdrop-blur-md rounded-3xl z-50 flex flex-col items-center justify-center text-white p-6 text-center animate-fade-in">
                <Sparkles className="w-16 h-16 mb-2 text-yellow-300 animate-bounce" />
                <h2 className="text-2xl font-extrabold mb-1">{matchPopup.title}</h2>
                <p className="text-xs text-purple-100 mb-4">{matchPopup.subtitle}</p>
                <div className="bg-white text-purple-700 px-6 py-3 rounded-2xl text-2xl font-black shadow-lg mb-6">
                  {matchPopup.name}
                </div>
                <button
                    onClick={() => setMatchPopup(null)}
                    className="bg-yellow-400 text-gray-900 font-bold px-6 py-2.5 rounded-xl hover:bg-yellow-300 transition shadow-md text-sm"
                >
                  Che bello! 🎉
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
                      <span>{getRoleBadgeText(currentUser)}</span>
                      <Edit3 className="w-3 h-3 text-purple-400 ml-0.5" />
                    </button>
                  </div>
              )}
            </div>

            {/* Navigazione Fasi */}
            {currentUser && (
                <div className="grid grid-cols-5 bg-purple-50 p-1 rounded-2xl mb-6 border border-purple-100 text-center gap-1">
                  <button
                      onClick={() => handleSwitchPhase(1)}
                      className={`py-2 text-[10px] font-bold rounded-xl transition ${
                          phase === 1 ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500'
                      }`}
                  >
                    1. Nomi
                  </button>
                  <button
                      onClick={() => handleSwitchPhase(2)}
                      className={`py-2 text-[10px] font-bold rounded-xl transition ${
                          phase === 2 ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500'
                      }`}
                  >
                    2. Swipe
                  </button>
                  <button
                      onClick={() => handleSwitchPhase(3)}
                      className={`py-2 text-[10px] font-bold rounded-xl transition ${
                          phase === 3 ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500'
                      }`}
                  >
                    3. Tutti
                  </button>
                  <button
                      onClick={() => handleSwitchPhase(4)}
                      className={`py-2 text-[10px] font-bold rounded-xl transition flex items-center justify-center gap-0.5 ${
                          phase === 4 ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500'
                      }`}
                  >
                    <Heart className="w-2.5 h-2.5 fill-purple-600 text-purple-600" /> Match
                  </button>
                  <button
                      onClick={() => handleSwitchPhase(5)}
                      className={`py-2 text-[10px] font-bold rounded-xl transition ${
                          phase === 5 ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500'
                      }`}
                  >
                    ❤️ Voti
                  </button>
                </div>
            )}
          </div>

          {/* LOGIN */}
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
                                  isParentRole === 'mom' ? 'bg-purple-600 text-white border-purple-600' : 'bg-purple-50/50 text-gray-600 border-purple-100'
                              }`}
                          >
                            <span>👩</span> Sono la Mamma
                          </button>
                          <button
                              type="button"
                              onClick={() => setIsParentRole(isParentRole === 'dad' ? null : 'dad')}
                              className={`py-2 px-2 text-xs font-semibold rounded-xl border transition flex items-center justify-center gap-1.5 ${
                                  isParentRole === 'dad' ? 'bg-purple-600 text-white border-purple-600' : 'bg-purple-50/50 text-gray-600 border-purple-100'
                              }`}
                          >
                            <span>👨</span> Sono il Papà
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
                          className="w-full bg-purple-600 text-white font-semibold py-2.5 rounded-xl hover:bg-purple-700 transition flex items-center justify-center gap-2 shadow-sm"
                      >
                        {loading ? 'Verifica...' : 'Entra nell\'app'} <ArrowRight className="w-4 h-4" />
                      </button>
                    </form>
                ) : (
                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 space-y-3">
                      <div className="flex items-start gap-2 text-amber-800">
                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600" />
                        <div>
                          <h4 className="font-bold text-sm">Esiste già un "{userName}"!</h4>
                          <p className="text-xs text-amber-700 mt-0.5">Sei già entrato in precedenza?</p>
                        </div>
                      </div>
                      <button
                          onClick={handleConfirmExistingUser}
                          className="w-full bg-amber-500 text-white font-bold py-2 rounded-xl hover:bg-amber-600 transition text-xs shadow-xs"
                      >
                        🔑 Sì, sono io! Rientra nel profilo
                      </button>
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
                  <span>I tuoi nomi (Tocca per il significato 📖):</span>
                  <span className="font-bold text-purple-700">{names.length} / 10</span>
                </div>

                <ul className="space-y-2 max-h-48 overflow-y-auto">
                  {names.map((item) => (
                      <li
                          key={item.id}
                          className="flex items-center justify-between p-3 bg-purple-50/40 rounded-xl border border-purple-100"
                      >
                        <button
                            onClick={() => setSelectedNameDetail({ text: item.name_text })}
                            className="font-medium text-purple-900 hover:underline flex items-center gap-1.5 text-left flex-1"
                        >
                          <span>✨ {item.name_text}</span>
                        </button>
                        <button
                            onClick={() => handleRemoveName(item.id)}
                            className="text-gray-400 hover:text-red-500 transition ml-2"
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
              <div className="flex-1 flex flex-col items-center justify-between relative my-2">
                {loading ? (
                    <p className="text-gray-400 text-sm my-auto">Caricamento...</p>
                ) : allNamesToVote.length > 0 ? (
                    <div className="relative w-full h-64 flex items-center justify-center my-auto">
                      {allNamesToVote.map((item) => (
                          <TinderCard
                              key={item.id}
                              onSwipe={(dir) => handleSwiped(dir, item)}
                              preventSwipe={['up', 'down']}
                              className="absolute w-full h-full"
                          >
                            <div className="w-full h-full bg-gradient-to-br from-purple-500 to-indigo-600 rounded-3xl shadow-xl flex flex-col items-center justify-center text-white p-6 cursor-grab active:cursor-grabbing border-4 border-white relative">
                              <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    setSelectedNameDetail({ text: item.name_text });
                                  }}
                                  onTouchEnd={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    setSelectedNameDetail({ text: item.name_text });
                                  }}
                                  className="pressable absolute top-4 right-4 bg-white/20 hover:bg-white/30 text-white text-[11px] px-3 py-1.5 rounded-full backdrop-blur-xs transition flex items-center gap-1 font-medium z-50 cursor-pointer"
                              >
                                <BookOpen className="w-3.5 h-3.5" /> Info
                              </button>

                              <HeartHandshake className="w-12 h-12 mb-3 text-purple-200" />
                              <h2 className="text-3xl font-extrabold tracking-wide drop-shadow-md">
                                {item.name_text}
                              </h2>

                              {/* TESTI DINAMICI IN BASE ALL'INVERSIONE */}
                              <div className="flex gap-8 mt-6 text-xs text-purple-100 font-medium">
                                {invertSwipe ? (
                                    <>
                                      <span>👈 Swipe Sinistra: Sì</span>
                                      <span>Swipe Destra: No 👉</span>
                                    </>
                                ) : (
                                    <>
                                      <span>👈 Swipe Sinistra: No</span>
                                      <span>Swipe Destra: Sì 👉</span>
                                    </>
                                )}
                              </div>
                            </div>
                          </TinderCard>
                      ))}
                    </div>
                ) : (
                    <div className="text-center py-8 my-auto">
                      <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                      <h3 className="font-bold text-gray-800">Hai votato tutti i nomi!</h3>
                      <p className="text-xs text-gray-500 mt-1">Guarda la classifica o i Match!</p>
                    </div>
                )}

                {/* PULSANTE ANNULLA ULTIMO VOTO */}
                <div className="w-full pt-2 flex justify-center">
                  {lastVotedItem && (
                      <button
                          onClick={handleUndoLastVote}
                          disabled={loading}
                          className="bg-purple-100 hover:bg-purple-200 text-purple-700 text-xs font-bold px-4 py-2 rounded-xl transition shadow-2xs flex items-center gap-1.5 border border-purple-200 cursor-pointer"
                      >
                        <span>↩️ Annulla ultimo voto</span>
                      </button>
                  )}
                </div>
              </div>
          )}

          {/* FASE 3: CLASSIFICA */}
          {currentUser && phase === 3 && (
              <div className="space-y-3 my-2 flex-1 flex flex-col justify-center">
                <h3 className="text-center font-bold text-gray-700 text-sm mb-1 flex items-center justify-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-500" /> Classifica Generale
                </h3>
                <p className="text-center text-[11px] text-gray-400 mb-2">
                  Tocca il nome per il significato 📖
                </p>

                {loading ? (
                    <p className="text-center text-gray-400 text-sm">Calcolo classifica...</p>
                ) : leaderboard.length > 0 ? (
                    <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {leaderboard.map((item, index) => (
                          <li
                              key={item.id}
                              className={`p-3 rounded-2xl border transition ${
                                  index === 0 ? 'bg-amber-50 border-amber-200' : 'bg-purple-50/30 border-purple-100'
                              }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-xs text-gray-400 w-4">{index + 1}.</span>
                                <button
                                    onClick={() => setSelectedNameDetail({ text: item.text })}
                                    className="font-bold text-gray-800 text-sm hover:text-purple-600 transition flex items-center gap-1.5 text-left"
                                >
                                  <span>{item.text}</span>
                                  <BookOpen className="w-3 h-3 text-purple-400" />
                                </button>
                              </div>

                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-xl border border-purple-100 shadow-xs">
                                  <Heart className="w-3.5 h-3.5 text-purple-600 fill-purple-600" />
                                  <span className="text-xs font-bold text-gray-700">{item.likes}</span>
                                </div>
                              </div>
                            </div>

                            {/* Elenco di chi ha messo mi piace */}
                            {item.voters && item.voters.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-purple-100/60 flex flex-wrap gap-1.5 items-center">
                                  <span className="text-[10px] text-gray-400 font-medium">Piace a:</span>
                                  {item.voters.map((voter: any) => (
                                      <span
                                          key={voter.id}
                                          className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded-lg border border-purple-100 text-[10px] font-semibold text-purple-800 shadow-2xs"
                                      >
                                        <span>{voter.avatar || '👶'}</span>
                                        <span>{voter.name}</span>
                                      </span>
                                  ))}
                                </div>
                            )}
                          </li>
                      ))}
                    </ul>
                ) : (
                    <p className="text-center text-xs text-gray-400">Nessun nome inserito.</p>
                )}
              </div>
          )}

          {/* FASE 4: MATCH & AFFINITÀ */}
          {currentUser && phase === 4 && (
              <div className="space-y-3 my-2 flex-1 flex flex-col justify-start max-h-80 overflow-y-auto pr-1">
                {topAffinityUser && (
                    <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-200 shadow-2xs flex items-center gap-3">
                      <div className="bg-amber-100 p-2 rounded-xl text-amber-600">
                        <Zap className="w-5 h-5 fill-amber-500" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-amber-900">La tua Sintonia Maggiore 💕</h4>
                        <p className="text-[11px] text-amber-700 mt-0.5">
                          Hai i gusti più simili a <strong className="text-amber-900">{topAffinityUser.user.name}</strong> ({topAffinityUser.count} in comune)!
                        </p>
                      </div>
                    </div>
                )}

                <div>
                  <h3 className="font-bold text-gray-800 text-xs mb-1.5 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" /> Match Mamma & Papà
                  </h3>
                  {coupleMatches.length > 0 ? (
                      <ul className="space-y-1.5">
                        {coupleMatches.map((item) => (
                            <li
                                key={item.id}
                                onClick={() => setSelectedNameDetail({ text: item.name_text })}
                                className="flex items-center justify-between p-2.5 bg-purple-50 rounded-xl border border-purple-200 cursor-pointer hover:bg-purple-100/50 transition"
                            >
                              <span className="font-extrabold text-purple-900 text-sm">✨ {item.name_text}</span>
                              <span className="text-[10px] bg-purple-600 text-white px-2 py-0.5 rounded-lg font-bold">
                        👩‍❤️‍👨 Intesa Perfetta
                      </span>
                            </li>
                        ))}
                      </ul>
                  ) : (
                      <p className="text-[11px] text-gray-400 italic bg-gray-50 p-2 rounded-xl border border-gray-100">
                        Nessun Match diretto Mamma-Papà al momento.
                      </p>
                  )}
                </div>
              </div>
          )}

          {/* FASE 5: REGISTRO VOTI PERSONALI */}
          {currentUser && phase === 5 && (
              <div className="space-y-3 my-2 flex-1 flex flex-col justify-start max-h-80 overflow-y-auto pr-1">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-bold text-gray-800 text-xs flex items-center gap-1.5">
                    📝 Il tuo Registro Voti
                  </h3>
                  <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">
                    Totale: {myVotesList.length}
                  </span>
                </div>

                {loading ? (
                    <p className="text-center text-gray-400 text-xs py-4">Caricamento voti...</p>
                ) : myVotesList.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-400 text-xs">Non hai ancora espresso alcun voto.</p>
                      <button
                          onClick={() => handleSwitchPhase(2)}
                          className="mt-2 text-xs text-purple-600 font-bold hover:underline"
                      >
                        Vai allo Swipe per votare! 👉
                      </button>
                    </div>
                ) : (
                    <ul className="space-y-2">
                      {myVotesList.map((vote) => (
                          <li
                              key={vote.id}
                              className="flex items-center justify-between p-2.5 bg-purple-50/50 rounded-xl border border-purple-100 shadow-2xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-base">
                                {vote.is_liked ? '💚' : '❌'}
                              </span>
                              <div>
                                <span className="font-bold text-gray-800 text-xs">
                                  {vote.names?.name_text || "Nome non disponibile"}
                                </span>
                                <p className="text-[9px] text-gray-400">
                                  {vote.is_liked ? 'Mi Piace' : 'Non Mi Piace'}
                                </p>
                              </div>
                            </div>

                            <button
                                onClick={() => handleDeleteVote(vote.id)}
                                title="Rimuovi voto"
                                className="text-xs bg-red-50 hover:bg-red-100 text-red-600 font-medium px-2.5 py-1 rounded-lg transition cursor-pointer"
                            >
                              Elimina
                            </button>
                          </li>
                      ))}
                    </ul>
                )}
              </div>
          )}

          {/* Footer info */}
          <div className="text-center text-xs text-gray-400 pt-3 border-t border-gray-100">
            {phase === 2 && currentUser && (
                <span>Voti completati: <strong className="text-purple-600">{votedCount}</strong></span>
            )}
            {(phase === 1 || phase === 3 || phase === 4 || phase === 5) && (
                <span>Tocca un nome per scoprire il significato 📖</span>
            )}
          </div>

        </div>
      </main>
  );
}