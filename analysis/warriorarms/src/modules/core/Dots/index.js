import { Fragment } from 'react';
import Analyzer from 'parser/core/Analyzer';
import StatisticsListBox, { STATISTIC_ORDER } from 'parser/ui/StatisticsListBox';

import DeepWoundsUptime from './DeepWoundsUptime';
import RendUptime from './RendUptime';

class DotUptimeStatisticBox extends Analyzer {
  static dependencies = {
    deepwoundsUptime: DeepWoundsUptime,
    rendUptime: RendUptime,
  };

  constructor(...args) {
    super(...args);
    this.active = Object.keys(this.constructor.dependencies)
      .map(name => this[name].active)
      .includes(true);
  }

  statistic() {
    return (
      <StatisticsListBox
        position={STATISTIC_ORDER.CORE(3)}
        title="DoT uptimes"
      >
        {Object.keys(this.constructor.dependencies).map(name => {
          const module = this[name];
          if (!module.active) {
            return null;
          }
          return (
            <Fragment key={name}>
              {module.subStatistic()}
            </Fragment>
          );
        })}
      </StatisticsListBox>
    );
  }
}

export default DotUptimeStatisticBox;
