import type { VercelApiHandler, VercelResponse } from '@vercel/node'

import {
  Whatsapp,
  sendMessageToPhoneNumber,
  sendSimpleButtonsMessage,
  markMessageAsRead,
} from '../../lib/whatsapp'

import {
  WhatsappNewMessageEventNotificationRequest,
  WhatsappParsedMessage,
} from './types'

import {
  getAddressByPhoneNumber,
  getPrivateKeyByPhoneNumber,
  getUserFromPhoneNumber,
} from '../../lib/user'

import { createUser } from '../../lib/user'

import { getAccountBalances } from 'lib/crypto'
import {
  Address,
  PhoneNumber,
  addReceiverToPayment,
  cancelPaymentRequest,
  confirmPaymentRequest,
  getPolygonScanUrlForAddress,
  getReceiverUserFromUncompletedPaymentRequest,
  getRecipientAddressFromUncompletedPaymentRequest,
  isReceiverInputPending,
  isUserAwaitingAmountInput,
  isUserAwaitingPinInput,
  isUserAwaitingBalancePinInput,
  isUserAwaitingLinkedinInput,
  isUserAwaitingLinkedinChoice,
  makePaymentRequest,
  sendUsdtFromWallet,
  setPaymentRequestToPinPending,
  setPaymentRequestToBalancePending,
  setPaymentRequestToLinkedinPending,
  setPaymentRequestToLinkedinChoicePending,
  updatePaymentRequestToError,
  getPendingPaymentRequest,
  isRegistrationPending,
  setRegistrationPending,
  clearRegistrationPending,
} from '../../lib/crypto/transaction'
import { linkLinkedinUrn, setVerificationCode } from '../../lib/user'
import { transformStringToNumber } from '../../lib/utils/number'
import { getSetting } from '../../lib/settings'
import { processInstagramLink, getLatestCandidate, updateDraftStatus } from '../../lib/viral-radar'

async function sendMenuButtonsTo(phoneNumber: string, isOwner = false) {
  const buttons = [
    { title: 'Deposit funds', id: 'check_address' },
    { title: 'Give me my Fakn money!', id: 'send_money' },
    { title: 'Link LinkedIn', id: 'link_linkedin' },
    { title: 'Check balance 🔎', id: 'check_balance' },
  ]
  
  if (isOwner) {
    buttons.push({ title: 'Show Top 5', id: 'show_top' })
    buttons.push({ title: 'Show Drafts', id: 'show_drafts' })
  }

  await sendSimpleButtonsMessage(phoneNumber, 'What would you like to do?', buttons)
}

const handler: VercelApiHandler = async (
  req: WhatsappNewMessageEventNotificationRequest,
  res: VercelResponse,
) => {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed' })
    return
  }

  try {
    const data: WhatsappParsedMessage = Whatsapp.parseMessage(req.body)

    if (data?.isMessage) {
      const {
        message: {
          from: { phone: recipientPhone, name: recipientName },
          type: typeOfMessage,
          message_id: messageId,
          text,
        },
      } = data

      const ownerNumber = await getSetting('OWNER_WHATSAPP_NUMBER')
      const isOwner = recipientPhone === ownerNumber

      const sendMenuButtons = async () => {
        sendMenuButtonsTo(recipientPhone, isOwner)
      }

      try {
        if (typeOfMessage === 'text_message' && text) {
          const body = text.body.trim()
          const instagramRegex = /https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\/[a-zA-Z0-9_-]+\/?/
          const match = body.match(instagramRegex)

          if (match) {
            if (!isOwner) {
              await sendMessageToPhoneNumber(recipientPhone, "This bot only processes content from the approved owner account.")
              res.status(200).send('ok')
              return
            }

            const url = match[0]
            const note = body.replace(url, '').trim()
            
            await sendMessageToPhoneNumber(recipientPhone, "Processing your Viral Radar candidate... 📡")
            
            try {
              const { analysis, draft } = await processInstagramLink(url, recipientPhone, note)
              
              let response = `Viral Radar Score: ${analysis.viral_score}/100\n\n`
              response += `*Why it works:*\n${analysis.why_it_worked}\n\n`
              response += `*Best LinkedIn angle:*\n${analysis.linkedin_angles[0]}\n\n`
              
              if (draft) {
                response += `*Draft:*\n${draft.linkedin_post}`
                await sendMessageToPhoneNumber(recipientPhone, response)
                await sendSimpleButtonsMessage(recipientPhone, "What's next?", [
                  { title: 'APPROVE', id: 'approve_draft' },
                  { title: 'REWRITE', id: 'rewrite_draft' },
                  { title: 'SKIP', id: 'skip_candidate' }
                ])
              } else {
                response += `Score too low for automatic draft generation.`
                await sendMessageToPhoneNumber(recipientPhone, response)
              }
            } catch (error) {
              console.error('Viral Radar Error:', error)
              await sendMessageToPhoneNumber(recipientPhone, "Error processing Instagram link. Please try again.")
            }
            res.status(200).send('ok')
            return
          }

          if (isOwner) {
            const upperBody = body.toUpperCase()
            if (upperBody === 'APPROVE') {
              const latest = await getLatestCandidate(recipientPhone)
              if (latest && latest.linkedin_drafts?.[0]) {
                await updateDraftStatus(latest.id, 'approved')
                await sendMessageToPhoneNumber(recipientPhone, "Draft approved and added to queue! ✅")
                await sendMenuButtons()
              }
              res.status(200).send('ok')
              return
            }
            if (upperBody === 'SKIP') {
              const latest = await getLatestCandidate(recipientPhone)
              if (latest) {
                await updateDraftStatus(latest.id, 'rejected')
                await sendMessageToPhoneNumber(recipientPhone, "Candidate skipped. ❌")
                await sendMenuButtons()
              }
              res.status(200).send('ok')
              return
            }
          }

          const user = await getUserFromPhoneNumber(recipientPhone)

          if (user) {
            if (text && (await isReceiverInputPending(user.id))) {
              const receiver: PhoneNumber | Address = text.body

              try {
                const validatedReceiver = await addReceiverToPayment({
                  userId: user.id,
                  receiver,
                })
                await sendSimpleButtonsMessage(
                  recipientPhone,
                  `How many USDT do you want to send to ${validatedReceiver}?`,
                  [{ title: 'Cancel transaction', id: 'cancel_send_money' }],
                )
                return
              } catch (error) {
                await sendSimpleButtonsMessage(
                  recipientPhone,
                  `The value is not valid, make sure it matches the address format or that the phone number has a Signal Room account \n ${error}`,
                  [{ title: 'Cancel transaction', id: 'cancel_send_money' }],
                )
              }

              return
            }
            if (text && (await isUserAwaitingAmountInput(user.id))) {
              let amount: number

              try {
                amount = transformStringToNumber(text.body)
              } catch (error) {
                await sendSimpleButtonsMessage(
                  recipientPhone,
                  `The format is not valid 🤕, make sure it's an integer or decimal number!`,
                  [{ title: 'Cancel transaction', id: 'cancel_send_money' }],
                )
                return
              }

              await setPaymentRequestToPinPending({ userId: user.id, amount })
              await sendMessageToPhoneNumber(
                recipientPhone,
                'Please enter your 6-digit PIN to confirm the transaction 🔐',
              )
              return
            }

            if (text && (await isUserAwaitingLinkedinInput(user.id))) {
              const urn = text.body
              try {
                await linkLinkedinUrn(user.id, urn)
                await sendMessageToPhoneNumber(
                  recipientPhone,
                  `Successfully linked your LinkedIn: ${urn} ✅`,
                )
                await cancelPaymentRequest(user.id)
              } catch (error) {
                await cancelPaymentRequest(user.id)
                await sendMessageToPhoneNumber(
                  recipientPhone,
                  `Error linking LinkedIn 🤕`,
                )
              }
              await sendMenuButtons()
              return
            }

            if (text && (await isUserAwaitingBalancePinInput(user.id))) {
              const pin = text.body
              await sendMessageToPhoneNumber(recipientPhone, 'Loading ⏳')

              try {
                const privateKey = await getPrivateKeyByPhoneNumber(
                  recipientPhone,
                  pin,
                )

                const { ethBalance, usdtBalance } = await getAccountBalances(
                  privateKey,
                )

                await sendMessageToPhoneNumber(
                  recipientPhone,
                  `${ethBalance} ETH`,
                )
                await sendMessageToPhoneNumber(
                  recipientPhone,
                  `${usdtBalance} USDT`,
                )
                await cancelPaymentRequest(user.id)
              } catch (error) {
                await cancelPaymentRequest(user.id)
                await sendMessageToPhoneNumber(
                  recipientPhone,
                  `Incorrect PIN or error loading balance 🤕`,
                )
              }
              await sendMenuButtons()
              return
            }

            if (text && (await isUserAwaitingPinInput(user.id))) {
              const pin = text.body

              try {
                const pr = await getPendingPaymentRequest(user.id)
                if (!pr || !pr.amount) throw new Error('No pending payment')

                const receiverUser =
                  await getReceiverUserFromUncompletedPaymentRequest(user.id)

                const senderPrivateKey = await getPrivateKeyByPhoneNumber(
                  recipientPhone,
                  pin,
                )

                await sendUsdtFromWallet({
                  tokenAmount: pr.amount,
                  privateKey: senderPrivateKey,
                  toAddress:
                    await getRecipientAddressFromUncompletedPaymentRequest(
                      user.id,
                    ),
                  isSponsored: true, // Pay for user withdrawals/transfers
                })

                await confirmPaymentRequest({
                  userId: user.id,
                  amount: pr.amount,
                })

                const address = await getAddressByPhoneNumber(recipientPhone)

                await sendMessageToPhoneNumber(
                  recipientPhone,
                  'Payment successful! 🎉 For more information: 👇👇👇 ',
                )

                if (receiverUser) {
                  await sendMessageToPhoneNumber(
                    receiverUser.phoneNumer,
                    `You received ${pr.amount} USDT from ${user.name} 🌟`,
                  )
                  await sendMenuButtonsTo(receiverUser.phoneNumer)
                }

                const polygonScanUrl = getPolygonScanUrlForAddress(address)

                await sendMessageToPhoneNumber(recipientPhone, polygonScanUrl)
              } catch (error) {
                await updatePaymentRequestToError(user.id)

                await sendMessageToPhoneNumber(
                  recipientPhone,
                  `The payment could not be completed 😢`,
                )

                await sendMessageToPhoneNumber(
                  recipientPhone,
                  `We had an error: ${(error as Error).message}`,
                )
              }
              await sendMenuButtons()
              return
            }

            if (text && (await isUserAwaitingLinkedinChoice(user.id))) {
                // This state is handled by buttons, but we can clear it if they send text
                await cancelPaymentRequest(user.id)
            }

            await sendMessageToPhoneNumber(
              recipientPhone,
              `Hello again${recipientName ? ` ${recipientName}` : ''}! 👋`,
            )
            await sendMenuButtons()
          } else {
            if (text && (await isRegistrationPending(recipientPhone))) {
              const pin = text.body
              if (pin.length < 6) {
                await sendMessageToPhoneNumber(
                  recipientPhone,
                  'The PIN must be at least 6 digits. Please try again:',
                )
                return
              }

              await sendMessageToPhoneNumber(
                recipientPhone,
                'Creating your wallet! 🔨',
              )

              try {
                const walletAddress = await createUser(
                  recipientPhone,
                  pin,
                  recipientName,
                )
                await clearRegistrationPending(recipientPhone)

                await sendMessageToPhoneNumber(
                  recipientPhone,
                  'Your wallet was created! 🚀✨\n your address is:',
                )
                await sendSimpleButtonsMessage(recipientPhone, walletAddress, [
                  { title: 'What is it?', id: 'info_address' },
                ])
                await sendMenuButtons()
              } catch (error) {
                await sendMessageToPhoneNumber(
                  recipientPhone,
                  'Error creating wallet 🤕',
                )
              }
              return
            }

            await sendMessageToPhoneNumber(
              recipientPhone,
              `Hello ${recipientName}! 👋`,
            )
            await sendMessageToPhoneNumber(
              recipientPhone,
              `I'm your favorite crypto-bot 🤖.\nYour most secure, reliable, and easy-to-use digital wallet service.`,
            )
            await sendSimpleButtonsMessage(
              recipientPhone,
              "I see you don't have a wallet associated with this number. Would you like to create one?",
              [{ title: 'Create a wallet', id: 'create_wallet' }],
            )
          }
        }

        if (typeOfMessage === 'simple_button_message') {
          const button_id = data.message.button_reply.id

          const user = await getUserFromPhoneNumber(recipientPhone)

          switch (button_id) {
            case 'approve_draft': {
              const latest = await getLatestCandidate(recipientPhone)
              if (latest) {
                await updateDraftStatus(latest.id, 'approved')
                await sendMessageToPhoneNumber(recipientPhone, "Draft approved and added to queue! ✅")
              }
              await sendMenuButtons()
              break
            }
            case 'skip_candidate': {
              const latest = await getLatestCandidate(recipientPhone)
              if (latest) {
                await updateDraftStatus(latest.id, 'rejected')
                await sendMessageToPhoneNumber(recipientPhone, "Candidate skipped. ❌")
              }
              await sendMenuButtons()
              break
            }
            case 'link_via_urn': {
              if (!user) throw new Error('User not found')
              await cancelPaymentRequest(user.id) // Clear choice pending
              await setPaymentRequestToLinkedinPending(user.id)
              await sendMessageToPhoneNumber(
                recipientPhone,
                'Please enter your LinkedIn Profile URN (e.g., urn:li:person:XXXX) 🔗',
              )
              break
            }
            case 'link_via_code': {
              if (!user) throw new Error('User not found')
              await cancelPaymentRequest(user.id) // Clear choice pending
              const code = await setVerificationCode(user.id)
              await sendMessageToPhoneNumber(
                recipientPhone,
                `Your unique verification code is: *${code}*\n\nComment this code on any of our LinkedIn posts to link your account automatically! 🚀`,
              )
              await sendMenuButtons()
              break
            }
            case 'send_money': {
              if (!user) {
                throw new Error('Unexpectedly user not found')
              }

              const { id } = user

              await makePaymentRequest({
                amount: null,
                fromUserId: id,
                to: null,
              })

              await sendMessageToPhoneNumber(
                recipientPhone,
                `Who do you want to send money to?`,
              )

              await sendSimpleButtonsMessage(
                recipientPhone,
                `Enter the phone number or the wallet address of the recipient`,
                [
                  {
                    title: 'Cancel',
                    id: 'cancel_send_money',
                  },
                ],
              )

              break
            }
            case 'link_linkedin': {
              if (!user) {
                throw new Error('Unexpectedly user not found')
              }
              await setPaymentRequestToLinkedinChoicePending(user.id)
              await sendSimpleButtonsMessage(
                recipientPhone,
                'How would you like to link your LinkedIn account?',
                [
                  { title: 'Provide URN', id: 'link_via_urn' },
                  { title: 'Get Code', id: 'link_via_code' },
                ],
              )
              break
            }
            case 'check_balance': {
              if (!user) {
                throw new Error('Unexpectedly user not found')
              }
              await setPaymentRequestToBalancePending(user.id)
              await sendMessageToPhoneNumber(
                recipientPhone,
                'Please enter your 6-digit PIN to check your balance 🔐',
              )
              break
            }
            case 'check_address': {
              await sendMessageToPhoneNumber(recipientPhone, 'Loading ⏳')
              const address = await getAddressByPhoneNumber(recipientPhone)
              await sendMessageToPhoneNumber(
                recipientPhone,
                'To deposit funds, you must send them to this address:',
              )
              await sendMessageToPhoneNumber(recipientPhone, address)
              await sendMessageToPhoneNumber(
                recipientPhone,
                '(Send USDT or ETH via Polygon zkEVM network)',
              )
              await sendMenuButtons()
              break
            }
            case 'create_wallet': {
              await setRegistrationPending(recipientPhone)
              await sendMessageToPhoneNumber(
                recipientPhone,
                'Please choose a 6-digit PIN to secure your new wallet 🔐',
              )
              break
            }
            case 'info_address': {
              await sendSimpleButtonsMessage(
                recipientPhone,
                'An address is like a bank account number that you can use to receive money from other people. In this case, the wallet uses the Polygon zkEVM network and supports USDT cryptocurrency. To make transfers, you will need ETH.',
                [{ title: 'What is ETH?', id: 'info_eth' }],
              )

              await sendMenuButtons()

              break
            }
            case 'info_eth':
              await sendMessageToPhoneNumber(
                recipientPhone,
                'ETH is the fuel that the blockchain needs to operate the network.',
              )
              await sendMenuButtons()
              break
            case 'cancel_send_money':
              if (!user) {
                throw new Error('Unexpectedly user not found')
              }
              await cancelPaymentRequest(user.id)
              await sendMessageToPhoneNumber(
                recipientPhone,
                'Transfer cancelled.',
              )

              await sendMenuButtons()
              break
            default:
              break
          }
        }
      } catch (error) {
        console.error({ error })
        await sendMessageToPhoneNumber(
          recipientPhone,
          `🔴 An error occurred: ${JSON.stringify(
            error,
            Object.getOwnPropertyNames(error),
          )}`,
        )
      }

      // note: important to mark message as read to avoid duplicate messages
      await markMessageAsRead({
        message_id: messageId,
      })

      res.status(200).send('ok')
      return
    }
  } catch (error) {
    console.error({ error })
    res.status(500).send('Internal server error')
    return
  }
}

export default handler
