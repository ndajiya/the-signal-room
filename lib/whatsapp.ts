import WhatsappCloudAPI from 'whatsappcloudapi_wrapper'

// Create a placeholder WhatsApp instance that won't throw on initialization
let Whatsapp: any = null

try {
  const accessToken = process.env.META_WA_ACCESS_TOKEN
  const senderPhoneNumberId = process.env.META_WA_SENDER_PHONE_NUMBER_ID
  const WABA_ID = process.env.META_WA_WABA_ID
  
  if (accessToken && senderPhoneNumberId && WABA_ID) {
    Whatsapp = new WhatsappCloudAPI({
      accessToken,
      senderPhoneNumberId,
      WABA_ID,
    })
  } else {
    console.warn('META_WA_ACCESS_TOKEN, META_WA_SENDER_PHONE_NUMBER_ID, or META_WA_WABA_ID not set. WhatsApp functionality will be limited.')
  }
} catch (error) {
  console.warn('Failed to initialize WhatsApp Cloud API:', error)
}

/**
 * Send a simple message to user
 * @param recipientPhone
 * @param message
 */
export async function sendMessageToPhoneNumber(
  recipientPhone: string,
  message: string,
): Promise<void> {
  if (!Whatsapp) {
    console.warn('WhatsApp not initialized. Cannot send message to:', recipientPhone)
    return
  }
  await Whatsapp.sendText({
    recipientPhone,
    message,
  })
}

/**
 * Send a simple buttons messages
 * @param recipientPhone
 * @param message
 * @param buttons
 */
export async function sendSimpleButtonsMessage(
  recipientPhone: string,
  message: string,
  buttons: {
    title: string
    id: string
  }[],
): Promise<void> {
  if (!Whatsapp) {
    console.warn('WhatsApp not initialized. Cannot send buttons message to:', recipientPhone)
    return
  }
  await Whatsapp.sendSimpleButtons({
    recipientPhone,
    message,
    listOfButtons: buttons,
  })
}

/**
 * Mark a message as read
 * @param params
 */
export async function markMessageAsRead(params: { message_id: string }): Promise<void> {
  if (!Whatsapp) {
    console.warn('WhatsApp not initialized. Cannot mark message as read:', params.message_id)
    return
  }
  await Whatsapp.markMessageAsRead(params)
}

// Export the Whatsapp instance
export { Whatsapp }
