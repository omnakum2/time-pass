import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { BidBaaziGuide } from '../components/BidBaaziGuide';
import { GAME_DESCRIPTORS } from '../games';

export function GuidePage() {
  const navigate = useNavigate();
  // The Guide is game-aware via the component registry: /thoso/guide shows Thoso's
  // rules, everything else falls back to the BidBaazi guide. Same page shell (and the
  // shared bilingual Guide component) either way. `showHomeLink` is passed through.
  const { game } = useParams();
  const GuideComp = GAME_DESCRIPTORS[game ?? '']?.play?.Guide ?? BidBaaziGuide;

  return (
    <div className="guide-page">
      <Button
        variant="secondary"
        size="sm"
        className="guide-back"
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
      >
        Go Back
      </Button>
      <GuideComp showHomeLink />
    </div>
  );
}
