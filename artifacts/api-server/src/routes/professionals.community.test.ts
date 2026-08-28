import assert from "node:assert/strict";
import { test } from "node:test";
import {
  COMMUNITY_MAX_UPLOAD,
  PROFILE_MEDIA_MAX_UPLOAD,
  isCommunityMediaType,
  isOwnedCommunityObjectPath,
  isProfessionalProfileMediaType,
  isOwnedProfessionalProfileObjectPath,
} from "./professionals";

test("accepts only image and video media for industry posts", () => {
  assert.equal(isCommunityMediaType("image/jpeg"), true);
  assert.equal(isCommunityMediaType("video/mp4"), true);
  assert.equal(isCommunityMediaType("audio/mpeg"), false);
  assert.equal(isCommunityMediaType("application/pdf"), false);
  assert.equal(isCommunityMediaType(undefined), false);
});

test("keeps community object paths scoped to the uploading account", () => {
  assert.equal(
    isOwnedCommunityObjectPath("/objects/professional-posts/user_123/asset", "user_123"),
    true,
  );
  assert.equal(
    isOwnedCommunityObjectPath("/objects/professional-posts/other_user/asset", "user_123"),
    false,
  );
  assert.equal(
    isOwnedCommunityObjectPath("/objects/professional-posts/user_123/../asset", "user_123"),
    false,
  );
});

test("bounds community uploads at 100MB", () => {
  assert.equal(COMMUNITY_MAX_UPLOAD, 100 * 1024 * 1024);
});

test("accepts only image and video media for professional galleries", () => {
  assert.equal(isProfessionalProfileMediaType("image/png"), true);
  assert.equal(isProfessionalProfileMediaType("video/webm"), true);
  assert.equal(isProfessionalProfileMediaType("audio/mpeg"), false);
  assert.equal(isProfessionalProfileMediaType("application/pdf"), false);
  assert.equal(isProfessionalProfileMediaType(null), false);
});

test("keeps professional gallery object paths scoped to the uploading account", () => {
  assert.equal(
    isOwnedProfessionalProfileObjectPath("/objects/professional-profile-media/user_123/asset", "user_123"),
    true,
  );
  assert.equal(
    isOwnedProfessionalProfileObjectPath("/objects/professional-profile-media/other_user/asset", "user_123"),
    false,
  );
  assert.equal(
    isOwnedProfessionalProfileObjectPath("/objects/professional-profile-media/user_123/../asset", "user_123"),
    false,
  );
});

test("bounds professional gallery uploads at 100MB", () => {
  assert.equal(PROFILE_MEDIA_MAX_UPLOAD, 100 * 1024 * 1024);
});