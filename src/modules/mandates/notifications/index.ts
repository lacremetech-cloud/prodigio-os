export {
  notifyNewMandateSubmission,
  type NotifyInput,
  type NotifyResult,
  type NotifyDeps,
} from "./notify";
export {
  buildMandateSlackMessage,
  crmDeepLink,
  escapeSlack,
  type SlackMessage,
  type MandateNotificationInput,
} from "./message";
export { postSlackWebhook, type SlackFetch, type SlackTransportResult } from "./slack";
