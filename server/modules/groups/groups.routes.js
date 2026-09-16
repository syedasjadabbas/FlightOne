import { Router } from "express";
import { validateBody, validateParams } from "../../lib/validate.js";
import { requireAuth } from "../../middlewares/auth.js";
import * as c from "./groups.controller.js";
import {
  addMemberSchema,
  attendanceSchema,
  createAnnouncementSchema,
  createGroupSchema,
  createPollSchema,
  emergencySchema,
  groupIdParamsSchema,
  inviteMemberSchema,
  joinGroupSchema,
  photoIdParamsSchema,
  pollIdParamsSchema,
  shareBookingSchema,
  shareDocumentSchema,
  shareIdParamsSchema,
  uploadPhotoSchema,
  voteSchema,
  waypointIdParamsSchema,
  waypointSchema,
} from "./groups.validators.js";

const router = Router();
router.use(requireAuth);

router.post("/", validateBody(createGroupSchema), c.createGroup);
router.get("/", c.listMyGroups);
router.post("/join", validateBody(joinGroupSchema), c.joinGroup);

router.get("/:id", validateParams(groupIdParamsSchema), c.getGroup);
router.post("/:id/leave", validateParams(groupIdParamsSchema), c.leaveGroup);
router.post("/:id/invitations/accept", validateParams(groupIdParamsSchema), c.acceptInvitation);
router.post("/:id/invitations/decline", validateParams(groupIdParamsSchema), c.declineInvitation);

router.get("/:id/members", validateParams(groupIdParamsSchema), c.listMembers);
router.post(
  "/:id/members",
  validateParams(groupIdParamsSchema),
  validateBody(addMemberSchema),
  c.addMember,
);
router.post(
  "/:id/invitations",
  validateParams(groupIdParamsSchema),
  validateBody(inviteMemberSchema),
  c.inviteMember,
);

router.post(
  "/:id/announcements",
  validateParams(groupIdParamsSchema),
  validateBody(createAnnouncementSchema),
  c.createAnnouncement,
);
router.get("/:id/announcements", validateParams(groupIdParamsSchema), c.listAnnouncements);
router.post(
  "/:id/emergency",
  validateParams(groupIdParamsSchema),
  validateBody(emergencySchema),
  c.createEmergency,
);

router.post(
  "/:id/polls",
  validateParams(groupIdParamsSchema),
  validateBody(createPollSchema),
  c.createPoll,
);
router.get("/:id/polls", validateParams(groupIdParamsSchema), c.listPolls);
router.post(
  "/:id/polls/:pollId/vote",
  validateParams(pollIdParamsSchema),
  validateBody(voteSchema),
  c.voteOnPoll,
);

router.get("/:id/itinerary", validateParams(groupIdParamsSchema), c.getItinerary);
router.get("/:id/itinerary/updates", validateParams(groupIdParamsSchema), c.getLiveUpdates);
router.get("/:id/flight-status", validateParams(groupIdParamsSchema), c.getFlightStatus);
router.post(
  "/:id/itinerary/bookings",
  validateParams(groupIdParamsSchema),
  validateBody(shareBookingSchema),
  c.shareBooking,
);
router.delete(
  "/:id/itinerary/bookings/:shareId",
  validateParams(shareIdParamsSchema),
  c.unshareBooking,
);

router.get("/:id/documents", validateParams(groupIdParamsSchema), c.listDocuments);
router.post(
  "/:id/documents",
  validateParams(groupIdParamsSchema),
  validateBody(shareDocumentSchema),
  c.shareDocument,
);
router.delete(
  "/:id/documents/:shareId",
  validateParams(shareIdParamsSchema),
  c.unshareDocument,
);

router.get("/:id/attendance", validateParams(groupIdParamsSchema), c.listAttendance);
router.post(
  "/:id/attendance/waypoints",
  validateParams(groupIdParamsSchema),
  validateBody(waypointSchema),
  c.createWaypoint,
);
router.post(
  "/:id/attendance/waypoints/:waypointId/mark",
  validateParams(waypointIdParamsSchema),
  validateBody(attendanceSchema),
  c.markAttendance,
);

router.get("/:id/photos", validateParams(groupIdParamsSchema), c.listPhotos);
router.post(
  "/:id/photos",
  validateParams(groupIdParamsSchema),
  validateBody(uploadPhotoSchema),
  c.uploadPhoto,
);
router.get(
  "/:id/photos/:photoId",
  validateParams(photoIdParamsSchema),
  c.getPhoto,
);
router.delete(
  "/:id/photos/:photoId",
  validateParams(photoIdParamsSchema),
  c.deletePhoto,
);

router.get("/:id/memories", validateParams(groupIdParamsSchema), c.listMemories);
router.post("/:id/memories/generate", validateParams(groupIdParamsSchema), c.generateMemory);

export default router;
