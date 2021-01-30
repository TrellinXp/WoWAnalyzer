import SPELLS from 'common/SPELLS';

import Analyzer, { SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, { DamageEvent } from 'parser/core/Events';
import { Options } from 'parser/core/Module';
import { Trans } from '@lingui/macro';

import Statistic from 'parser/ui/Statistic';
import ItemDamageDone from 'parser/ui/ItemDamageDone';
import STATISTIC_CATEGORY from 'parser/ui/STATISTIC_CATEGORY';
import ConduitSpellText from 'parser/ui/ConduitSpellText';
import calculateEffectiveDamage from 'parser/core/calculateEffectiveDamage';

import { HAUNTING_APPARITIONS_DAMAGE_INCREASE } from '@wowanalyzer/priest-shadow/src/constants';
import { formatNumber } from 'common/format';

class HauntingApparitions extends Analyzer {

  conduitRank = 0;
  damage = 0;

  constructor(options: Options) {
    super(options);

    this.conduitRank = this.selectedCombatant.conduitRankBySpellID(SPELLS.HAUNTING_APPARITIONS.id);
    if (!this.conduitRank) {
      this.active = false;
      return;
    }

    this.addEventListener(Events.damage.by(SELECTED_PLAYER).spell(SPELLS.SHADOWY_APPARITION_DAMAGE), this.onDamage);
  }

  onDamage(event: DamageEvent) {
    this.damage += calculateEffectiveDamage(event, HAUNTING_APPARITIONS_DAMAGE_INCREASE[this.conduitRank]);
  }

  statistic() {
    return (
      <Statistic
        size="flexible"
        category={STATISTIC_CATEGORY.COVENANTS}
        tooltip={(
          <Trans id="priest.shadow.conduits.hauntingApparitions.tooltip">
            This is the bonus damage gained from the conduit.<br/><br/>
            Total damage: {formatNumber(this.damage)}
          </Trans>
        )}
      >
        <ConduitSpellText spell={SPELLS.HAUNTING_APPARITIONS} rank={this.conduitRank}>
          <>
            <ItemDamageDone amount={this.damage} /> <br />
          </>
        </ConduitSpellText>
      </Statistic>
    );
  }

}

export default HauntingApparitions;
