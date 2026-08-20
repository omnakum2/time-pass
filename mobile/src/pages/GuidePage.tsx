// How to Play — mobile-native guide for Bid Club.
// Concise English summary of the web guide (client/src/pages/GuidePage.tsx).
// Fresh RN implementation — the web CSS is intentionally NOT ported.
import React from 'react';
import { ScrollView, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';
import { scale } from '../lib/scale';

export function GuidePage() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Overview</Text>
      <Text style={styles.body}>
        Bid Club is a trick-taking prediction game played over 7 rounds. The cards
        dealt count down from 7 in the first round to 1 in the last. Each round you
        predict how many tricks you will win, and you only score by matching that
        prediction exactly — being close is not enough. The rules below describe
        Classic mode; other modes each change just one thing.
      </Text>

      <Text style={styles.title}>Rounds & Dealing</Text>
      <Text style={styles.body}>
        Round 7 deals 7 cards to every player, Round 6 deals 6, and so on down to
        Round 1, which deals a single card. The rounds always count down:
        7 → 6 → 5 → 4 → 3 → 2 → 1. Every round begins with a fresh shuffle of the
        full deck. One suit is trump each round (chosen randomly, never the same
        two rounds running) and beats every other suit; a No-Trump round has none.
      </Text>

      <Text style={styles.title}>Bidding</Text>
      <Text style={styles.body}>
        Before each round every player predicts how many tricks they will win,
        anywhere from 0 up to the round number (so up to 7 in Round 7, up to 1 in
        Round 1). The first bidder rotates by one seat each round, and that same
        player leads the first trick.
      </Text>

      <Text style={styles.title}>Playing Tricks</Text>
      <Text style={styles.body}>
        The player on lead plays a card, and everyone else must follow the led suit
        if they hold it. If you cannot follow, you may play anything, including a
        trump. The highest trump in the trick wins it; if no trump was played, the
        highest card of the led suit wins. The winner of the trick leads the next
        one.
      </Text>

      <Text style={styles.title}>Scoring</Text>
      <Text style={styles.body}>
        Your score for a round depends entirely on whether your bid was exact:
        {'\n'}• Exact bid · bid × 10 plus the bid itself, i.e. bid × 11.
        {'\n'}• Wrong bid · you lose bid × 10.
        {'\n'}• Correct bid of 0 · you score +10.
        {'\n'}• Missed bid of 0 · you score −10.
      </Text>

      <Text style={styles.title}>Game Modes</Text>
      <Text style={styles.body}>
        The host picks a mode when creating the room; each one changes a single rule.
        {'\n'}• Classic · the original game — 7 rounds counting down 7 → 1 with a random trump each round.
        {'\n'}• Up & Down · 13 rounds climbing 1 → 7 then back to 1, with rising score multipliers on wins and losses.
        {'\n'}• Blind Bid · bid before you see your hand, then Lock your bid (×2) or Push it up by one (×3).
        {'\n'}• Revolving Trump · the first bidder chooses the round's trump instead of it being random.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    padding: scale(18),
    paddingBottom: scale(40),
  },
  title: {
    color: colors.gold,
    fontSize: scale(18),
    fontWeight: '800',
    marginTop: scale(16),
    marginBottom: scale(6),
  },
  body: {
    color: colors.cream,
    fontSize: scale(14),
    lineHeight: scale(21),
  },
});
