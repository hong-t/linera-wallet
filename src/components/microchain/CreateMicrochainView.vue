<template>
  <div class='full-width'>
    <q-stepper
      flat v-model='step' animated
      alternative-labels
      header-class='hide'
      :style='{marginTop: "-16px"}'
    >
      <q-step :name='1' :done='step > 1' title='Creating' class='flex items-center justify-center'>
        <q-card flat class='loading-card'>
          <q-inner-loading
            :showing='createdMicrochain === undefined'
            class='text-red-4'
          >
            <q-spinner-facebook size='80px' />
          </q-inner-loading>
        </q-card>
      </q-step>
      <q-step :name='2' :done='step > 2' title='Backup'>
        <MicrochainCreationView :microchain='createdMicrochain' @backuped='onMicrochainBackuped' />
      </q-step>
      <q-step :name='3' :done='step > 3' title='Validate'>
        <ValidateMicrochainView :microchain='createdMicrochain' @validated='onMicrochainValidated' />
      </q-step>
    </q-stepper>
  </div>
</template>

<script setup lang='ts'>
import { onMounted, ref } from 'vue'
import { dbModel } from 'src/model'
import { localStore } from 'src/localstores'
import { useI18n } from 'vue-i18n'
import { rpcBridge } from 'src/bridge'

import MicrochainCreationView from './MicrochainCreationView.vue'
import ValidateMicrochainView from './ValidateMicrochainView.vue'

const { t } = useI18n({ useScope: 'global' })

const createdMicrochain = ref(undefined as unknown as dbModel.Microchain)
const step = ref(1)

const emit = defineEmits<{(ev: 'created', value: dbModel.Microchain): void,
  (ev: 'error'): void
}>()

const createMicrochain = async (): Promise<dbModel.Microchain> => {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    rpcBridge.Microchain.openMicrochain().then((microchain: dbModel.Microchain) => {
      localStore.notification.pushNotification({
        Title: t('MSG_OPEN_CHAIN'),
        Message: t('MSG_SUCCESS_OPEN_MICROCHAIN'),
        Popup: true,
        Type: localStore.notify.NotifyType.Info
      })

      resolve(microchain)
    }).catch((error) => {
      localStore.notification.pushNotification({
        Title: t('MSG_OPEN_CHAIN'),
        Message: t('MSG_FAILED_OPEN_MICROCHAIN', { ERROR: error }),
        Popup: true,
        Type: localStore.notify.NotifyType.Error
      })
      reject(error)
    })
  })
}

onMounted(() => {
  createMicrochain().then((microchain) => {
    createdMicrochain.value = microchain
    step.value++
  }).catch((e) => {
    console.log('Failed create microchain', e)
    emit('error')
  })
})

const onMicrochainBackuped = () => {
  step.value++
}

const onMicrochainValidated = () => {
  emit('created', createdMicrochain.value)
}

</script>
