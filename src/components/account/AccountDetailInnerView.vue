<template>
  <q-card class='selector-card'>
    <div class='page-x-padding'>
      <AccountDetailAvatarView v-if='owner' :owner='owner' :editable='true' />
      <div class='text-center vertical-sections-margin'>
        <QrcodeVue :value='owner.address' :size='160' />
      </div>
      <div class='row bg-red-1 tip vertical-sections-margin flex justify-center items-center cursor-pointer'>
        <div class='word-break-all' :style='{width: "calc(100% - 16px)"}'>
          0x{{ owner.address }}
        </div>
        <q-icon name='bi-copy' size='16px' @click.stop='(evt) => _copyToClipboard(owner.address, evt)' />
      </div>
      <q-btn
        flat no-caps class='btn btn-alt full-width vertical-sections-margin'
        label='Show private key'
        @click='onShowPrivateKeyClick'
      />
    </div>
  </q-card>
  <DbOwnerBalanceBridge v-model:token-balance='tokenBalance' v-model:usd-balance='usdBalance' :token-id='nativeTokenId' />
</template>

<script setup lang='ts'>
import { dbModel } from 'src/model'
import { onMounted, ref, toRef } from 'vue'
import QrcodeVue from 'qrcode.vue'
import { _copyToClipboard } from 'src/utils/copycontent'
import { dbBridge } from 'src/bridge'

import DbOwnerBalanceBridge from '../bridge/db/OwnerBalanceBridge.vue'
import AccountDetailAvatarView from './AccountDetailAvatarView.vue'

interface Props {
  owner: dbModel.Owner
}
const props = defineProps<Props>()
const owner = toRef(props, 'owner')

const tokenBalance = ref(0)
const usdBalance = ref(0)
const nativeTokenId = ref(0)

const emit = defineEmits<{(ev: 'showPrivateKey'): void}>()

onMounted(async () => {
  nativeTokenId.value = (await dbBridge.Token.native())?.id as number
})

const onShowPrivateKeyClick = () => {
  emit('showPrivateKey')
}

</script>

<style scope lang='sass'>
</style>
