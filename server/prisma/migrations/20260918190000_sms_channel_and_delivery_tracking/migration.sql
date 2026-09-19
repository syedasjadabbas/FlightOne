-- NotificationOutbox — SMS channel & delivery status tracking (DELIVERED, READ)
-- Strictly according to SDS Appendix D Notification Event Catalogue.

ALTER TYPE "NotificationChannel" ADD VALUE IF NOT EXISTS 'SMS';
ALTER TYPE "NotificationStatus" ADD VALUE IF NOT EXISTS 'DELIVERED';
ALTER TYPE "NotificationStatus" ADD VALUE IF NOT EXISTS 'READ';
