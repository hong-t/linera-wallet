<template>
  <div class='page-padding full-width text-center home-tabs'>
    <q-tabs
      v-model='tab' no-caps indicator-color='red-6' dense
    >
      <q-tab name='microchains' :class='[ localStore.setting.extensionMode ? "extension-tab" : "" ]'>
        {{ $t('MSG_MICROCHAINS') }}
      </q-tab>
      <q-tab name='tokens' :class='[ localStore.setting.extensionMode ? "extension-tab" : "" ]'>
        {{ $t('MSG_TOKENS') }}
      </q-tab>
      <q-tab name='applications' :class='[ localStore.setting.extensionMode ? "extension-tab" : "" ]'>
        {{ $t('MSG_APPLICATIONS') }}
      </q-tab>
      <q-tab name='activities' :class='[ localStore.setting.extensionMode ? "extension-tab" : "" ]'>
        {{ $t('MSG_ACTIVITIES') }}
      </q-tab>
    </q-tabs>
    <q-tab-panels v-model='tab' swipeable animated>
      <q-tab-panel name='tokens'>
        <TokensView />
      </q-tab-panel>
      <q-tab-panel name='microchains'>
        <MicrochainsView />
      </q-tab-panel>
      <q-tab-panel name='applications'>
        <ApplicationsView />
      </q-tab-panel>
      <q-tab-panel name='activities'>
        <ActivitiesView x-padding='6px' />
      </q-tab-panel>
    </q-tab-panels>
  </div>
</template>

<script setup lang='ts'>
import { computed, onMounted } from 'vue'
import { localStore } from 'src/localstores'
import { dbBridge } from 'src/bridge'

import TokensView from '../token/TokensView.vue'
import MicrochainsView from '../microchain/MicrochainsView.vue'
import ApplicationsView from '../application/ApplicationsView.vue'
import ActivitiesView from '../activity/ActivitiesView.vue'

import { lineraLogo } from 'src/assets'

const tab = computed({
  get: () => localStore.setting.homeTab || 'microchains',
  set: (v: string) => {
    localStore.setting.HomeTab = v
  }
})

onMounted(async () => {
  await dbBridge.Token.initialize(lineraLogo)
  await dbBridge.Network.initialize()
})

</script>

<stype scope lang='sass'>
.extension-tab
  padding: 0 4px
</stype>
