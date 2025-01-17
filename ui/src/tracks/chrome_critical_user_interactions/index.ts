// Copyright (C) 2023 The Android Open Source Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {v4 as uuidv4} from 'uuid';

import {Actions} from '../../common/actions';
import {SCROLLING_TRACK_GROUP} from '../../common/state';
import {OnSliceClickArgs} from '../../frontend/base_slice_track';
import {GenericSliceDetailsTab} from '../../frontend/generic_slice_details_tab';
import {globals} from '../../frontend/globals';
import {
  NAMED_ROW,
  NamedSliceTrackTypes,
} from '../../frontend/named_slice_track';
import {NewTrackArgs, TrackBase} from '../../frontend/track';
import {
  Plugin,
  PluginContext,
  PluginContextTrace,
  PluginDescriptor,
  PrimaryTrackSortKey,
  Slice,
  STR,
} from '../../public';
import {
  CustomSqlDetailsPanelConfig,
  CustomSqlImportConfig,
  CustomSqlTableDefConfig,
  CustomSqlTableSliceTrack,
} from '../custom_sql_table_slices';

import {PageLoadDetailsPanel} from './page_load_details_panel';

export const CRITICAL_USER_INTERACTIONS_KIND =
    'org.chromium.CriticalUserInteraction.track';

export const CRITICAL_USER_INTERACTIONS_ROW = {
  ...NAMED_ROW,
  type: STR,
};
export type CriticalUserInteractionRow = typeof CRITICAL_USER_INTERACTIONS_ROW;

export interface CriticalUserInteractionSlice extends Slice {
  type: string;
}

export interface CriticalUserInteractionSliceTrackTypes extends
    NamedSliceTrackTypes {
  slice: CriticalUserInteractionSlice;
  row: CriticalUserInteractionRow;
}

enum CriticalUserInteractionType {
  UNKNOWN = 'Unknown',
  PAGE_LOAD = 'chrome_page_loads',
}

function convertToCriticalUserInteractionType(cujType: string):
    CriticalUserInteractionType {
  switch (cujType) {
    case CriticalUserInteractionType.PAGE_LOAD:
      return CriticalUserInteractionType.PAGE_LOAD;
    default:
      return CriticalUserInteractionType.UNKNOWN;
  }
}

export class CriticalUserInteractionTrack extends
    CustomSqlTableSliceTrack<CriticalUserInteractionSliceTrackTypes> {
  static readonly kind = CRITICAL_USER_INTERACTIONS_KIND;

  static create(args: NewTrackArgs): TrackBase {
    return new CriticalUserInteractionTrack(args);
  }

  getSqlDataSource(): CustomSqlTableDefConfig {
    return {
      columns: ['scoped_id AS id', 'name', 'ts', 'dur', 'type'],
      sqlTableName: 'chrome_interactions',
    };
  }

  getDetailsPanel(
      args: OnSliceClickArgs<CriticalUserInteractionSliceTrackTypes['slice']>):
      CustomSqlDetailsPanelConfig {
    let detailsPanel = {
      kind: GenericSliceDetailsTab.kind,
      config: {
        sqlTableName: this.tableName,
        title: 'Chrome Interaction',
      },
    };

    switch (convertToCriticalUserInteractionType(args.slice.type)) {
      case CriticalUserInteractionType.PAGE_LOAD:
        detailsPanel = {
          kind: PageLoadDetailsPanel.kind,
          config: {
            sqlTableName: this.tableName,
            title: 'Chrome Page Load',
          },
        };
        break;
      default:
        break;
    }
    return detailsPanel;
  }

  getSqlImports(): CustomSqlImportConfig {
    return {
      modules: ['chrome.interactions'],
    };
  }

  getRowSpec(): CriticalUserInteractionSliceTrackTypes['row'] {
    return CRITICAL_USER_INTERACTIONS_ROW;
  }

  rowToSlice(row: CriticalUserInteractionSliceTrackTypes['row']):
      CriticalUserInteractionSliceTrackTypes['slice'] {
    const baseSlice = super.rowToSlice(row);
    const type = row.type;
    return {...baseSlice, type};
  }
}

export function addCriticalUserInteractionTrack() {
  const trackKey = uuidv4();
  globals.dispatchMultiple([
    Actions.addTrack({
      key: trackKey,
      uri: CriticalUserInteractionTrack.kind,
      name: `Chrome Interactions`,
      trackSortKey: PrimaryTrackSortKey.DEBUG_TRACK,
      trackGroup: SCROLLING_TRACK_GROUP,
    }),
    Actions.toggleTrackPinned({trackKey}),
  ]);
}

class CriticalUserInteractionPlugin implements Plugin {
  async onTraceLoad(ctx: PluginContextTrace): Promise<void> {
    ctx.registerStaticTrack({
      uri: CriticalUserInteractionTrack.kind,
      kind: CriticalUserInteractionTrack.kind,
      displayName: 'Chrome Interactions',
      track: (trackCtx) => new CriticalUserInteractionTrack(
          {engine: ctx.engine, trackKey: trackCtx.trackKey}),
    });
  }

  onActivate(ctx: PluginContext): void {
    ctx.registerCommand({
      id: 'perfetto.CriticalUserInteraction.AddInteractionTrack',
      name: 'Add Chrome Interactions track',
      callback: () => addCriticalUserInteractionTrack(),
    });
  }
}

export const plugin: PluginDescriptor = {
  pluginId: 'perfetto.CriticalUserInteraction',
  plugin: CriticalUserInteractionPlugin,
};
