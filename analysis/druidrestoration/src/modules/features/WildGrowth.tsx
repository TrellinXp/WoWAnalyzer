import { t } from '@lingui/macro';
import { formatPercentage } from 'common/format';
import SPELLS from 'common/SPELLS';
import { SpellLink } from 'interface';
import { SpellIcon } from 'interface';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, { ApplyBuffEvent, CastEvent, HealEvent } from 'parser/core/Events';
import { ThresholdStyle, When } from 'parser/core/ParseResults';
import AbilityTracker from 'parser/shared/modules/AbilityTracker';
import HealingValue from 'parser/shared/modules/HealingValue';
import BoringValue from 'parser/ui/BoringValueText';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_ORDER from 'parser/ui/STATISTIC_ORDER';
import React from 'react';

const RECOMMENDED_HIT_THRESHOLD = 5;
const PRECAST_PERIOD = 3000;
const PRECAST_THRESHOLD = 0.5;

class WildGrowth extends Analyzer {
  get averageEffectiveHits() {
    return this.wgHistory.reduce((a, b) => a + b.wgBuffs.length, 0) / this.wgs || 0;
  }

  get belowRecommendedCasts() {
    return this.wgHistory.filter((wg) => wg.wgBuffs.length < RECOMMENDED_HIT_THRESHOLD).length;
  }

  get belowRecommendedPrecasts() {
    return this.wgHistory.filter((wg) => wg.badPrecast === true).length;
  }

  get wgs() {
    return this.abilityTracker.getAbility(SPELLS.WILD_GROWTH.id).casts || 0;
  }

  get rejuvs() {
    return this.abilityTracker.getAbility(SPELLS.REJUVENATION.id).casts || 0;
  }

  get wgsPerRejuv() {
    return this.wgs / this.rejuvs || 0;
  }

  get percentBelowRecommendedCasts() {
    return this.belowRecommendedCasts / this.wgs || 0;
  }

  get percentBelowRecommendedPrecasts() {
    return this.belowRecommendedPrecasts / this.wgs || 0;
  }

  get suggestionThresholds() {
    return {
      actual: this.wgsPerRejuv,
      isLessThan: {
        minor: 0.12,
        average: 0.08,
        major: 0.03,
      },
      style: ThresholdStyle.PERCENTAGE,
    };
  }

  get suggestionpercentBelowRecommendedCastsThresholds() {
    return {
      actual: this.percentBelowRecommendedCasts,
      isGreaterThan: {
        minor: 0.0,
        average: 0.15,
        major: 0.35,
      },
      style: ThresholdStyle.PERCENTAGE,
    };
  }

  get suggestionpercentBelowRecommendedPrecastsThresholds() {
    return {
      actual: this.percentBelowRecommendedPrecasts,
      isGreaterThan: {
        minor: 0.05,
        average: 0.15,
        major: 0.35,
      },
      style: ThresholdStyle.PERCENTAGE,
    };
  }

  static dependencies = {
    abilityTracker: AbilityTracker,
  };

  abilityTracker!: AbilityTracker;

  wgHistory: WGTracker[] = [];
  wgTracker: WGTracker = {
    wgBuffs: [],
    startTimestamp: 0,
    heal: 0,
    overheal: 0,
    firstTicksOverheal: 0,
    firstTicksRaw: 0,
  };

  constructor(options: Options) {
    super(options);
    this.wgTracker.startTimestamp = this.owner.fight.start_time;
    this.addEventListener(Events.cast.by(SELECTED_PLAYER).spell(SPELLS.WILD_GROWTH), this.onCast);
    this.addEventListener(Events.heal.by(SELECTED_PLAYER).spell(SPELLS.WILD_GROWTH), this.onHeal);
    this.addEventListener(
      Events.applybuff.by(SELECTED_PLAYER).spell(SPELLS.WILD_GROWTH),
      this.onApplyBuff,
    );
    this.addEventListener(Events.fightend, this.onFightend);
  }

  onCast(event: CastEvent) {
    if (this.wgTracker.wgBuffs.length > 0) {
      this.wgTracker.badPrecast =
        this.wgTracker.firstTicksOverheal / this.wgTracker.firstTicksRaw > PRECAST_THRESHOLD;
      this.wgHistory.push(this.wgTracker);
    }

    this.wgTracker = {
      wgBuffs: [],
      startTimestamp: event.timestamp,
      heal: 0,
      overheal: 0,
      firstTicksOverheal: 0,
      firstTicksRaw: 0,
    };
  }

  onHeal(event: HealEvent) {
    const healVal = new HealingValue(event.amount, event.absorbed, event.overheal);
    this.wgTracker.heal += healVal.effective;
    this.wgTracker.overheal += healVal.overheal;

    // Track overhealing first couple ticks to determine if WG was precast before damaging event.
    if (event.timestamp - this.wgTracker.startTimestamp < PRECAST_PERIOD) {
      this.wgTracker.firstTicksRaw += healVal.raw;
      this.wgTracker.firstTicksOverheal += healVal.overheal;
    }
  }

  onApplyBuff(event: ApplyBuffEvent) {
    this.wgTracker.wgBuffs.push(event.targetID);
  }

  onFightend() {
    this.wgHistory.push(this.wgTracker);
  }

  suggestions(when: When) {
    when(this.suggestionpercentBelowRecommendedPrecastsThresholds).addSuggestion(
      (suggest, actual, recommended) =>
        suggest(
          <>
            Your initial healing from <SpellLink id={SPELLS.WILD_GROWTH.id} /> were doing too much
            overhealing. <SpellLink id={SPELLS.WILD_GROWTH.id} /> does most of it's healing
            initially and declines over duration. Make sure you are not precasting it before
            damaging event but after damage occurs.
          </>,
        )
          .icon(SPELLS.WILD_GROWTH.icon)
          .actual(
            t({
              id: 'druid.restoration.suggestions.wildgrowth.overhealing',
              message: `${formatPercentage(actual)}% of casts with high overhealing.`,
            }),
          )
          .recommended(`<${formatPercentage(recommended)}% is recommended`),
    );
    when(this.suggestionpercentBelowRecommendedCastsThresholds).addSuggestion((suggest) =>
      suggest(
        <>
          You sometimes cast <SpellLink id={SPELLS.WILD_GROWTH.id} /> on too few targets.{' '}
          <SpellLink id={SPELLS.WILD_GROWTH.id} /> is not mana efficient when hitting few targets,
          you should only cast it when you can hit at least {RECOMMENDED_HIT_THRESHOLD} wounded
          targets. Make sure you are not casting on a primary target isolated from the raid.{' '}
          <SpellLink id={SPELLS.WILD_GROWTH.id} /> has a maximum hit radius, the injured raiders
          could have been out of range. Also, you should never pre-hot with{' '}
          <SpellLink id={SPELLS.WILD_GROWTH.id} />.
        </>,
      )
        .icon(SPELLS.WILD_GROWTH.icon)
        .actual(
          t({
            id: 'druid.restoration.suggestions.wildgrowth.tooFewTargets',
            message: `${formatPercentage(
              this.percentBelowRecommendedCasts,
              0,
            )}% of your casts on fewer than ${RECOMMENDED_HIT_THRESHOLD} targets.`,
          }),
        )
        .recommended(`never casting on fewer than ${RECOMMENDED_HIT_THRESHOLD} is recommended`),
    );
    when(this.suggestionThresholds).addSuggestion((suggest, actual, recommended) =>
      suggest(
        <>
          Your <SpellLink id={SPELLS.WILD_GROWTH.id} /> to rejuv ratio can be improved, try to cast
          more wild growths if possible as it is usually more efficient.
        </>,
      )
        .icon(SPELLS.WILD_GROWTH.icon)
        .actual(
          t({
            id: 'druid.restoration.suggestions.wildgrowth.rejuvenationRatio',
            message: `${this.wgs} WGs / ${this.rejuvs} rejuvs`,
          }),
        )
        .recommended(`>${formatPercentage(recommended)}% is recommended`),
    );
  }

  statistic() {
    return (
      <Statistic
        size="flexible"
        position={STATISTIC_ORDER.CORE(19)}
        tooltip={
          <>
            Your Wild Growth hit on average {this.averageEffectiveHits.toFixed(2)} players.
            {this.belowRecommendedCasts} of your cast(s) hit fewer than 5 players which is the
            recommended targets.
          </>
        }
      >
        <BoringValue
          label={
            <>
              <SpellIcon id={SPELLS.WILD_GROWTH.id} /> Average Wild Growth Hits
            </>
          }
        >
          <>{this.averageEffectiveHits.toFixed(2)}</>
        </BoringValue>
      </Statistic>
    );
  }
}

interface WGTracker {
  wgBuffs: number[];
  startTimestamp: number;
  heal: number;
  overheal: number;
  firstTicksOverheal: number;
  firstTicksRaw: number;
  badPrecast?: boolean;
}

export default WildGrowth;
