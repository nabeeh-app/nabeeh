import { apiClient } from "@/lib/client";
import logger from "@/lib/logger";

export const checkWhatsAppStatus = async (_phone?: string) => {
  try {
    const data = await apiClient.getWhatsAppStatus();
    return {
      success: true,
      status: (data.status || "disconnected") as
        | "connected"
        | "disconnected"
        | "qr_ready"
        | "connecting"
        | "error",
      message:
        data.status === "connected"
          ? "Connected"
          : data.status === "qr_ready"
            ? "Scan QR Code"
            : "Disconnected",
      qr: data.qr || null,
      phone: data.phone || null,
      pairingCodeMode: data.pairingCodeMode || false,
    };
  } catch (error) {
    logger.error("Check Status Error:", error);
    return {
      success: false,
      status: "disconnected" as const,
      message: "Error checking WhatsApp status",
      qr: null,
      phone: null,
      pairingCodeMode: false,
    };
  }
};

export const sendWhatsAppMessage = async (phone: string, message: string) => {
  try {
    const response = await apiClient.api.post("/whatsapp/send-to-number", {
      phone,
      message,
    });
    const data = response.data;
    return {
      success: data.success,
      message:
        data.message ||
        (data.success
          ? "Message sent successfully"
          : "Failed to send message"),
    };
  } catch (error) {
    logger.error("Send message error:", error);
    return {
      success: false,
      message: "Error sending message",
    };
  }
};
