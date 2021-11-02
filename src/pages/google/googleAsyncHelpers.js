import axios from "axios";

const API_HOST = process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST;

export const verifyToken = async (authSig, googleAuthResponse) => {
  return await axios
    .post(API_HOST + "/api/google/verifyToken", {
      authSig,
      googleAuthResponse,
    });
}

export const getUserProfile = async (authSig, uniqueId) => {
  return await axios
    .post(API_HOST + "/api/google/getUserProfile", {
      authSig,
      uniqueId,
    });
}

export const storeConnectedServiceAccessToken = async (authSig, token) => {
  return await axios
    .post(API_HOST + "/api/google/connect", {
      authSig,
      token,
    });
}

export const share = async (requestData, requestOptions) => {
  const {driveId, role, token, connectedServiceId, accessControlConditions, authSig} = requestData
  return await axios
    .post(
      API_HOST + "/api/google/share",
      {
        driveId,
        role,
        token,
        connectedServiceId,
        accessControlConditions,
        authSig,
      },
      requestOptions
    );
}

export const getAllShares = async () => {
  return await axios.get(API_HOST + "/api/google/getAllShares");
}

export const deleteShare = async (shareUuid) => {
  return await axios.post(`${API_HOST}/api/google/deleteShare`, {uuid: shareUuid});
}