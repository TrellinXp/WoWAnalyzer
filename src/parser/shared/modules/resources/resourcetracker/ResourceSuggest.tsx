import { formatPercentage } from 'common/format';
import { SpellLink } from 'interface';
import { Trans } from '@lingui/macro';

import Spell from 'common/SPELLS/Spell';

import { When } from 'parser/core/ParseResults';

import ResourceTracker from './ResourceTracker';

interface Suggestion {
  spell: Spell | any;
  minor: number;
  avg: number;
  major: number;
  extraSuggestion?: string | JSX.Element;
}

function suggest(when: When, tracker: ResourceTracker, suggestion: Suggestion) {
  let tracked = { generated: 0, wasted: 0, casts: 0 };
  //If an array of spells is passed, we manipulate the data to aggregate all the generated and wasted resources as well as the individual focus instances into 1 spell so that it can be displayed.
  if (Array.isArray(suggestion.spell)) {
    let newSuggestionSpell: Spell = { id: -1, name: '', icon: '' };
    for (const spell of suggestion.spell) {
      if (!tracker.buildersObj[spell.id]) {
        continue;
      }
      if (newSuggestionSpell.id === -1) {
        newSuggestionSpell = spell;
      }
      tracked.generated += tracker.buildersObj[spell.id].generated;
      tracked.wasted += tracker.buildersObj[spell.id].wasted;
      tracked.casts += tracker.buildersObj[spell.id].casts;
    }
    suggestion.spell = newSuggestionSpell;
  } else {
    tracked = tracker.buildersObj[suggestion.spell.id];
  }
  if (!tracked) {
    return;
  }

  const maxGenerated = tracked.generated + tracked.wasted;
  const wastedShare = (tracked.wasted / maxGenerated) || 0;
  const resourceNameLower = tracker.resource.name.toLowerCase();

  when(wastedShare).isGreaterThan(suggestion.minor)
    .addSuggestion((suggest) => suggest(
      <>
        You are wasting {resourceNameLower} generated by <SpellLink id={suggestion.spell.id} />. {suggestion.extraSuggestion}
      </>,
    )
      .icon(suggestion.spell.icon)
      .actual(<Trans id='shared.suggestions.resources.wasted'> {formatPercentage(wastedShare)}% wasted. Generated {tracked.generated} out of {maxGenerated} possible {resourceNameLower} </Trans>)
      .recommended(`<${formatPercentage(suggestion.minor)}%  ${resourceNameLower} wasted is recommend`)
      .regular(suggestion.avg).major(suggestion.major));
}

export default suggest;
