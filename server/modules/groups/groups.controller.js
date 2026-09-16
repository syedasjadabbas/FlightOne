import { successResponse } from "../../lib/response.js";
import * as groupsService from "./groups.service.js";

function handle(fn) {
  return async (req, res, next) => {
    try {
      await fn(req, res);
    } catch (e) {
      next(e);
    }
  };
}

export const createGroup = handle(async (req, res) => {
  const data = await groupsService.createGroup(req.user.id, req.body);
  return successResponse(res, "Group created", data, 201);
});

export const listMyGroups = handle(async (req, res) => {
  const data = await groupsService.listMyGroups(req.user.id);
  return successResponse(res, "OK", data);
});

export const getGroup = handle(async (req, res) => {
  const data = await groupsService.getGroup(req.params.id, req.user.id, req.permissions);
  return successResponse(res, "OK", data);
});

export const joinGroup = handle(async (req, res) => {
  const data = await groupsService.joinGroupByInviteCode(req.user.id, req.body.inviteCode);
  return successResponse(res, "Joined group", data, 201);
});

export const inviteMember = handle(async (req, res) => {
  const data = await groupsService.inviteMember(
    req.params.id,
    req.user.id,
    req.permissions,
    req.body,
  );
  return successResponse(res, "Invitation sent", data, 201);
});

export const addMember = handle(async (req, res) => {
  const data = await groupsService.addMember(
    req.params.id,
    req.user.id,
    req.permissions,
    req.body,
  );
  return successResponse(res, "Member added", data, 201);
});

export const listMembers = handle(async (req, res) => {
  const data = await groupsService.listMembers(req.params.id, req.user.id, req.permissions);
  return successResponse(res, "OK", data);
});

export const acceptInvitation = handle(async (req, res) => {
  const data = await groupsService.acceptInvitation(req.params.id, req.user.id);
  return successResponse(res, "Invitation accepted", data);
});

export const declineInvitation = handle(async (req, res) => {
  const data = await groupsService.declineInvitation(req.params.id, req.user.id);
  return successResponse(res, "Invitation declined", data);
});

export const leaveGroup = handle(async (req, res) => {
  const data = await groupsService.leaveGroup(req.params.id, req.user.id);
  return successResponse(res, "Left group", data);
});

export const createAnnouncement = handle(async (req, res) => {
  const data = await groupsService.createAnnouncement(
    req.params.id,
    req.user.id,
    req.permissions,
    req.body,
  );
  return successResponse(res, "Announcement posted", data, 201);
});

export const createEmergency = handle(async (req, res) => {
  const data = await groupsService.createEmergencyBroadcast(
    req.params.id,
    req.user.id,
    req.permissions,
    req.body,
  );
  return successResponse(res, "Emergency broadcast sent", data, 201);
});

export const listAnnouncements = handle(async (req, res) => {
  const data = await groupsService.listAnnouncements(
    req.params.id,
    req.user.id,
    req.permissions,
  );
  return successResponse(res, "OK", data);
});

export const createPoll = handle(async (req, res) => {
  const data = await groupsService.createPoll(
    req.params.id,
    req.user.id,
    req.permissions,
    req.body,
  );
  return successResponse(res, "Poll created", data, 201);
});

export const voteOnPoll = handle(async (req, res) => {
  const data = await groupsService.voteOnPoll(
    req.params.id,
    req.params.pollId,
    req.user.id,
    req.permissions,
    req.body,
  );
  return successResponse(res, "Vote recorded", data, 201);
});

export const listPolls = handle(async (req, res) => {
  const data = await groupsService.listPolls(req.params.id, req.user.id, req.permissions);
  return successResponse(res, "OK", data);
});

export const shareBooking = handle(async (req, res) => {
  const data = await groupsService.shareBooking(
    req.params.id,
    req.user.id,
    req.permissions,
    req.body,
  );
  return successResponse(res, "Booking shared", data, 201);
});

export const unshareBooking = handle(async (req, res) => {
  const data = await groupsService.unshareBooking(
    req.params.id,
    req.params.shareId,
    req.user.id,
    req.permissions,
  );
  return successResponse(res, "Booking unshared", data);
});

export const getItinerary = handle(async (req, res) => {
  const data = await groupsService.getSharedItinerary(
    req.params.id,
    req.user.id,
    req.permissions,
  );
  return successResponse(res, "OK", data);
});

export const getFlightStatus = handle(async (req, res) => {
  const data = await groupsService.getGroupFlightStatus(
    req.params.id,
    req.user.id,
    req.permissions,
  );
  return successResponse(res, "OK", data);
});

export const getLiveUpdates = handle(async (req, res) => {
  const data = await groupsService.getLiveItineraryUpdates(
    req.params.id,
    req.user.id,
    req.permissions,
  );
  return successResponse(res, "OK", data);
});

export const shareDocument = handle(async (req, res) => {
  const data = await groupsService.shareVaultDocument(
    req.params.id,
    req.user.id,
    req.permissions,
    req.body,
  );
  return successResponse(res, "Document shared", data, 201);
});

export const listDocuments = handle(async (req, res) => {
  const data = await groupsService.listSharedDocuments(
    req.params.id,
    req.user.id,
    req.permissions,
  );
  return successResponse(res, "OK", data);
});

export const unshareDocument = handle(async (req, res) => {
  const data = await groupsService.unshareDocument(
    req.params.id,
    req.params.shareId,
    req.user.id,
    req.permissions,
  );
  return successResponse(res, "Document unshared", data);
});

export const createWaypoint = handle(async (req, res) => {
  const data = await groupsService.createAttendanceWaypoint(
    req.params.id,
    req.user.id,
    req.permissions,
    req.body,
  );
  return successResponse(res, "Waypoint created", data, 201);
});

export const markAttendance = handle(async (req, res) => {
  const data = await groupsService.markAttendance(
    req.params.id,
    req.params.waypointId,
    req.user.id,
    req.permissions,
    req.body,
  );
  return successResponse(res, "Attendance recorded", data, 201);
});

export const listAttendance = handle(async (req, res) => {
  const data = await groupsService.listAttendance(req.params.id, req.user.id, req.permissions);
  return successResponse(res, "OK", data);
});

export const uploadPhoto = handle(async (req, res) => {
  const data = await groupsService.uploadGroupPhoto(
    req.params.id,
    req.user.id,
    req.permissions,
    req.body,
  );
  return successResponse(res, "Photo uploaded", data, 201);
});

export const listPhotos = handle(async (req, res) => {
  const data = await groupsService.listGroupPhotos(req.params.id, req.user.id, req.permissions);
  return successResponse(res, "OK", data);
});

export const getPhoto = handle(async (req, res) => {
  const data = await groupsService.getGroupPhotoContent(
    req.params.id,
    req.params.photoId,
    req.user.id,
    req.permissions,
  );
  return successResponse(res, "OK", data);
});

export const deletePhoto = handle(async (req, res) => {
  const data = await groupsService.deleteGroupPhoto(
    req.params.id,
    req.params.photoId,
    req.user.id,
    req.permissions,
  );
  return successResponse(res, "Photo deleted", data);
});

export const generateMemory = handle(async (req, res) => {
  const data = await groupsService.generateTripMemory(
    req.params.id,
    req.user.id,
    req.permissions,
  );
  return successResponse(res, "Trip memory generated", data, 201);
});

export const listMemories = handle(async (req, res) => {
  const data = await groupsService.listTripMemories(req.params.id, req.user.id, req.permissions);
  return successResponse(res, "OK", data);
});
