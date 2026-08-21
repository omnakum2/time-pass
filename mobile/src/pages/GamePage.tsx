import { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimatePresence } from 'moti';
import { Suit, Player, legalMoves, SUIT_ORDER, RANK_ORDER, isHandHiddenForBid } from 'shared';
import { useGameStore } from '../store/gameStore';
import { sendMsg } from '../net/socket';
import { getTotal } from '../lib/helpers';
import { scale, cardWidth, cardHeight } from '../lib/scale';
import { colors } from '../theme';
import { URGENT_LEAD_MS } from '../constants';
import { CardView } from '../components/CardView';
import { TrickArea } from '../components/TrickArea';
import { BidPanel } from '../components/BidPanel';
import { TrumpPicker } from '../components/TrumpPicker';
import { PushPanel } from '../components/PushPanel';
import { PlayerChip } from '../components/PlayerChip';
import { Popup } from '../components/Popup';
import { RoundResultOverlay } from '../components/RoundResultOverlay';
import { QuickMessages } from '../components/QuickMessages';
import { Announcement } from '../components/Announcement';

// The portrait game table. Ported from the web GamePage: same turn/timer/legal-move
// logic, laid out for a phone — opponents strip (scrollable) on top, felt trick area
// in the middle, my HUD strip, and my hand (scrollable) at the bottom. Bid/Trump/Push
// come up as centered popups when it's my turn.
export function GamePage() {
  const { gameState, playerId, lastRoundResult } = useGameStore();
  const prevTurnRef = useRef<string>('');
  const prevTrickEmptyRef = useRef(true);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [urgent, setUrgent] = useState(false);

  const phase = gameState?.phase ?? '';
  const currentTurn = gameState?.currentTurn ?? null;
  const turnTimeoutMs = gameState?.turnTimeoutMs ?? 0;
  const turnRemainingMs = gameState?.turnRemainingMs ?? 0;
  const turnExpiresAt = gameState?.turnExpiresAt ?? null;
  const timerKey = String(turnExpiresAt ?? 'none');
  const timerRunning = turnExpiresAt != null;
  const currentTrick = gameState?.currentTrick ?? [];

  // Reset the selection whenever it becomes a new turn (new active player or fresh
  // trick lead). Guarded by refs so it converges (same pattern as the web client).
  const trickEmpty = currentTrick.length === 0;
  if (currentTurn && (currentTurn !== prevTurnRef.current || (trickEmpty && !prevTrickEmptyRef.current))) {
    prevTurnRef.current = currentTurn;
    setSelectedCard(null);
  }
  prevTrickEmptyRef.current = trickEmpty;

  useEffect(() => {
    setUrgent(false);
    if (timerRunning && (phase === 'BIDDING' || phase === 'PLAYING' || phase === 'TRUMP_SELECT') && currentTurn) {
      const lead = Math.max(0, turnRemainingMs - URGENT_LEAD_MS);
      const id = setTimeout(() => setUrgent(true), lead);
      return () => clearTimeout(id);
    }
  }, [timerKey, timerRunning, turnRemainingMs, phase, currentTurn]);

  const [pushDecided, setPushDecided] = useState(false);
  useEffect(() => { if (phase !== 'PUSH') setPushDecided(false); }, [phase]);

  if (!gameState || !playerId) {
    return (
      <SafeAreaView style={styles.loading}><Text style={styles.loadingText}>Loading game…</Text></SafeAreaView>
    );
  }

  const { round, trumpConfig, yourHand, bids, players, tricksWon, scoreboard, mode } = gameState;

  const isMyTurn = currentTurn === playerId;
  const myBid = bids[playerId] ?? null;
  const myWon = tricksWon[playerId] ?? 0;
  const leadSuit: Suit | null = currentTrick.length > 0 ? currentTrick[0].card.suit : null;

  const legalIds = isMyTurn && phase === 'PLAYING'
    ? legalMoves(yourHand, leadSuit).map((c) => c.id)
    : [];

  const sortedHand = [...yourHand].sort((a, b) => {
    const si = SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit);
    return si !== 0 ? si : RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank);
  });

  const handleCardPress = (cardId: string) => {
    if (!isMyTurn || phase !== 'PLAYING') return;
    if (!legalIds.includes(cardId)) return;
    if (selectedCard === cardId) {
      sendMsg({ type: 'playCard', cardId });
      setSelectedCard(null);
    } else {
      setSelectedCard(cardId);
    }
  };

  // Opponents in clockwise seat order from me.
  const me = players.find((p) => p.id === playerId);
  const opponents: Player[] = [];
  if (me) {
    const n = players.length;
    for (let i = 1; i < n; i++) {
      const opp = players.find((p) => p.seatIndex === (me.seatIndex + i) % n);
      if (opp) opponents.push(opp);
    }
  }

  const chipProps = (p: Player) => ({
    player: p,
    bid: bids[p.id] ?? null,
    tricksWon: tricksWon[p.id] ?? 0,
    isActive: currentTurn === p.id,
    phase,
    remainingMs: turnRemainingMs,
    fullMs: turnTimeoutMs,
    startKey: timerKey,
    running: timerRunning,
    totalScore: getTotal(scoreboard, p.id),
    pushChoice: gameState.pushStatus?.[p.id],
  });

  const blindHidden = isHandHiddenForBid(mode, gameState.phase);
  const activeName = currentTurn ? players.find((p) => p.id === currentTurn)?.name ?? '' : '';
  const statusText =
    phase === 'TRUMP_SELECT' ? (isMyTurn ? 'Choose the trump' : currentTurn ? `Waiting for ${activeName} to choose the trump…` : '')
    : phase === 'BIDDING' ? (isMyTurn ? 'Place your bid' : currentTurn ? `Waiting for ${activeName} to bid…` : '')
    : phase === 'PLAYING' ? (isMyTurn ? 'Your turn' : currentTurn ? `Waiting for ${activeName}…` : '')
    : phase === 'PUSH' ? (pushDecided ? 'Waiting for others…' : 'Lock or push your blind bid')
    : '';

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <Announcement announcement={gameState.announcement} />
      <RoundResultOverlay result={lastRoundResult} visible={phase === 'ROUND_SCORING'} />

      <Popup visible={phase === 'PUSH' && !pushDecided} title="Lock or Push?">
        <PushPanel
          bid={myBid ?? 0}
          cards={round ?? 0}
          remainingMs={turnRemainingMs}
          fullMs={turnTimeoutMs}
          startKey={timerKey}
          running={timerRunning}
          onDecide={(push) => { sendMsg({ type: 'pushBid', push }); setPushDecided(true); }}
        />
      </Popup>

      <Popup visible={phase === 'BIDDING' && isMyTurn} title={`Round ${round} · How many tricks will you win?`}>
        <BidPanel round={round!} remainingMs={turnRemainingMs} fullMs={turnTimeoutMs} startKey={timerKey} running={timerRunning} />
      </Popup>

      <Popup visible={phase === 'TRUMP_SELECT' && isMyTurn} title="Choose this round's trump">
        <TrumpPicker
          remainingMs={turnRemainingMs}
          fullMs={turnTimeoutMs}
          startKey={timerKey}
          running={timerRunning}
          limited={mode === 'upDown'}
        />
      </Popup>

      {/* Opponents */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.opponents}>
        {opponents.map((p) => (
          <PlayerChip key={p.id} {...chipProps(p)} />
        ))}
      </ScrollView>

      {/* Trick area */}
      <View style={styles.tableWrap}>
        <TrickArea
          trick={currentTrick}
          players={players}
          round={round}
          status={statusText}
          trumpConfig={trumpConfig}
          urgent={urgent}
          mode={mode}
        />
      </View>

      {/* My strip */}
      <View style={styles.myStrip}>
        <PlayerChip {...chipProps(me!)} isMe />
        <View style={styles.stripRight}>
          {selectedCard ? <Text style={styles.tapHint}>Tap again to play</Text> : null}
          <QuickMessages />
        </View>
      </View>

      {/* My hand */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hand}>
        {blindHidden ? (
          Array.from({ length: round ?? 0 }).map((_, i) => <View key={i} style={styles.cardBack} />)
        ) : (
          <AnimatePresence>
            {sortedHand.map((card) => (
              <CardView
                key={card.id}
                card={card}
                disabled={isMyTurn && phase === 'PLAYING' ? !legalIds.includes(card.id) : false}
                selected={selectedCard === card.id}
                onPress={() => handleCardPress(card.id)}
              />
            ))}
          </AnimatePresence>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: colors.creamMuted, fontSize: scale(15) },
  opponents: { flexDirection: 'row', gap: scale(8), paddingHorizontal: scale(10), paddingVertical: scale(8), alignItems: 'flex-start' },
  tableWrap: { flex: 1 },
  myStrip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: scale(10), paddingVertical: scale(6), gap: scale(8),
  },
  stripRight: { flexDirection: 'row', alignItems: 'center', gap: scale(8) },
  tapHint: { color: colors.gold, fontSize: scale(12), fontStyle: 'italic' },
  hand: { flexDirection: 'row', gap: scale(6), paddingHorizontal: scale(10), paddingVertical: scale(10), alignItems: 'flex-end' },
  cardBack: {
    width: cardWidth(), height: cardHeight(), borderRadius: 8,
    backgroundColor: colors.card1, borderWidth: 2, borderColor: colors.goldBorder,
  },
});
