import { useEffect, useState } from "react";
import { ShareModal } from "lit-access-control-conditions-modal";
import LitJsSdk from "lit-js-sdk";
import dotenv from "dotenv";
import ServiceHeader from "../sharedComponents/serviceHeader/ServiceHeader.js";
import GoogleLinks from "./googleLinks/GoogleLinks";
import GoogleProvisionAccessModal from "./googleProvisionAccessModal/GoogleProvisionAccessModal";
import { Alert, Button, Snackbar } from "@mui/material";
// import googleDriveLogo from '../../assets/googledrive.png';

import "./GoogleGranting.scss";
import * as asyncHelpers from "./googleAsyncHelpers.js";

const API_HOST = process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST;
const FRONT_END_HOST = process.env.REACT_APP_LIT_PROTOCOL_OAUTH_FRONTEND_HOST;
const GOOGLE_CLIENT_KEY =
  process.env.REACT_APP_LIT_PROTOCOL_OAUTH_GOOGLE_CLIENT_ID;

const googleRoleMap = {
  Read: "reader",
  Comment: "commenter",
  Write: "writer",
};

export default function GoogleGranting() {
  const parsedEnv = dotenv.config();

  const [file, setFile] = useState(null);
  const [allShares, setAllShares] = useState([]);
  const [token, setToken] = useState("");
  const [connectedServiceId, setConnectedServiceId] = useState("");
  const [accessControlConditions, setAccessControlConditions] = useState([]);
  const [role, setRole] = useState("reader");
  const [currentUser, setCurrentUser] = useState({});
  const [storedAuthSig, setStoredAuthSig] = useState({});
  const [humanizedAccessControlArray, setHumanizedAccessControlArray] =
    useState([]);

  const [openShareModal, setOpenShareModal] = useState(false);
  const [openProvisionAccessDialog, setOpenProvisionAccessDialog] =
    useState(false);
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [snackbarInfo, setSnackbarInfo] = useState({});

  useEffect(() => {
    loadAuth();
  }, []);

  useEffect(() => {
    const humanizeAccessControlConditions = async () => {
      return await LitJsSdk.humanizeAccessControlConditions({
        accessControlConditions,
        myWalletAddress: storedAuthSig.address,
      });
    };
    humanizeAccessControlConditions().then(
      (humanizedAccessControlConditions) => {
        setHumanizedAccessControlArray(() => humanizedAccessControlConditions);
      }
    );
  }, [accessControlConditions]);

  const handleAddAccessControl = () => {
    setOpenShareModal(true);
    setOpenProvisionAccessDialog(false);
  };

  const handleGetShareLink = async () => {
    setOpenProvisionAccessDialog(false);
    setFile(null);
    await handleSubmit();
  };

  const handleOpenProvisionAccessDialog = () => {
    setOpenProvisionAccessDialog(true);
  };

  const handleCancelProvisionAccessDialog = () => {
    setOpenProvisionAccessDialog(false);
    setAccessControlConditions([]);
    setFile(null);
  };

  const handleCloseSnackbar = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }
    setOpenSnackbar(false);
  };

  const loadAuth = async () => {
    try {
      const litAuthResult = await LitJsSdk.checkAndSignAuthMessage({
        chain: "ethereum",
      });
      setStoredAuthSig(() => litAuthResult);
      await loadGoogleAuth();
    } catch (err) {
      console.log("LIT AUTH FAILURE", err);
    }
  };

  const loadGoogleAuth = async () => {
    window.gapi.load("client:auth2", function () {
      window.gapi.auth2
        .init({
          client_id: GOOGLE_CLIENT_KEY,
          scope: "https://www.googleapis.com/auth/drive.file",
        })
        .then(async (googleObject) => {
          const currentUserObject = window.gapi.auth2
            .getAuthInstance()
            .currentUser.get();
          const grantedScopes = currentUserObject.getGrantedScopes();
          // check to see if signed in and scope for drive exists, if scope does not exist but use is signed in, notify with snackbar and sign out the user
          if (
            googleObject.isSignedIn.get() &&
            !!grantedScopes &&
            grantedScopes.includes("https://www.googleapis.com/auth/drive.file")
          ) {
            await checkForUserLocally(currentUserObject);
          } else if (
            googleObject.isSignedIn.get() &&
            !grantedScopes.includes(
              "https://www.googleapis.com/auth/drive.file"
            )
          ) {
            setSnackbarInfo({
              message: `Insufficient Permission: Request had insufficient authentication scopes.`,
              severity: "error",
            });
            setOpenSnackbar(true);
            signOut();
          }
        });
    });
    window.gapi.load("picker", { callback: onPickerApiLoad });
  };

  const onPickerApiLoad = () => {
    console.log("Google Picker Loaded");
  };

  const getAuthSig = async () => {
    return await LitJsSdk.checkAndSignAuthMessage({
      chain: "ethereum",
    });
  };

  const checkForUserLocally = async (currentUserObject) => {
    const authSig = await getAuthSig();
    setStoredAuthSig(authSig);
    try {
      const userProfiles = await asyncHelpers.getUserProfile(
        authSig,
        currentUserObject.getId()
      );
      if (userProfiles?.data[0]) {
        await setLatestAccessToken(currentUserObject);
      } else {
        console.log("No user found locally. Please log in again.");
        setSnackbarInfo({
          message: `No user found locally. Please log in again.`,
          severity: "error",
        });
        setOpenSnackbar(true);
      }
    } catch (err) {
      console.log("No user found locally:", err);
      setSnackbarInfo({
        message: `No user found locally: ${err}`,
        severity: "error",
      });
      setOpenSnackbar(true);
    }
  };

  const setLatestAccessToken = async (currentUserObject) => {
    const googleAuthResponse = currentUserObject.getAuthResponse();
    try {
      const authSig = await getAuthSig();
      const response = await asyncHelpers.verifyToken(
        authSig,
        googleAuthResponse
      );

      setConnectedServiceId(() => response.data.connectedServices[0].id);
      setCurrentUser(() => response.data.userProfile);
      setToken(() => googleAuthResponse.access_token);
      await getAllShares(authSig);
    } catch (err) {
      console.log("Error verifying user:", err);
      setSnackbarInfo({
        message: `Error verifying user:, ${err}`,
        severity: "error",
      });
      setOpenSnackbar(true);
    }
  };

  const getAllShares = async (authSig) => {
    const allSharesHolder = await asyncHelpers.getAllShares(authSig);
    setAllShares(allSharesHolder.data.reverse());
  };

  const authenticate = async () => {
    const authSig = await getAuthSig();
    setStoredAuthSig(authSig);
    try {
      const authResult = await window.gapi.auth2
        .getAuthInstance()
        .grantOfflineAccess({
          scope: "https://www.googleapis.com/auth/drive.file",
        });
      if (authResult.code) {
        await storeToken(authSig, authResult.code);
      }
    } catch (err) {
      console.log("Error logging in:", err);
      setSnackbarInfo({
        message: `Error logging in: ${err}`,
        severity: "error",
      });
      setOpenSnackbar(true);
    }
  };

  const storeToken = async (authSig, token) => {
    try {
      const response = await asyncHelpers.storeConnectedServiceAccessToken(
        authSig,
        token
      );
      console.log("ERROR MAYBE?", response);
      if (response.data["errorStatus"]) {
        setSnackbarInfo({
          message: `Error logging in: ${response.data.errors[0]["message"]}`,
          severity: "error",
        });
        setOpenSnackbar(true);
        signOut();
        return;
      }
      if (!!response.data["connectedServices"]) {
        await setConnectedServiceId(response.data.connectedServices[0].id);
        const googleAuthInstance = window.gapi.auth2.getAuthInstance();
        const currentUserObject = googleAuthInstance.currentUser.get();
        setToken(() => currentUserObject.getAuthResponse().access_token);
        const userBasicProfile = currentUserObject.getBasicProfile();
        const userProfile = {
          email: userBasicProfile.getEmail(),
          displayName: userBasicProfile.getName(),
          givenName: userBasicProfile.getGivenName(),
          avatar: userBasicProfile
            .getName()
            .split(" ")
            .map((s) => s.split("")[0])
            .join(""),
        };
        setCurrentUser(() => userProfile);
      }
    } catch (err) {
      console.log(`Error storing access token:, ${err.errors}`);
      setSnackbarInfo({
        message: `Error storing access token:, ${err}`,
        severity: "error",
      });
      setOpenSnackbar(true);
      signOut();
    }
  };

  const signOut = () => {
    const auth2 = window.gapi.auth2.getAuthInstance();
    auth2.signOut().then(function () {
      auth2.disconnect();
    });
    setAccessControlConditions([]);
    setToken("");
    setCurrentUser({});
  };

  const addToAccessControlConditions = async (r) => {
    const concatAccessControlConditions = accessControlConditions.concat(r);
    await setAccessControlConditions(concatAccessControlConditions);
  };

  const removeAccessControlCondition = async (i) => {
    setAccessControlConditions([]);
    // let slice1 = accessControlConditions.slice(0, i);
    // let slice2 = accessControlConditions.slice(
    //   i + 1,
    //   accessControlConditions.length
    // );
    // setAccessControlConditions(slice1.concat(slice2));
  };

  const handleSubmit = async () => {
    const authSig = await LitJsSdk.checkAndSignAuthMessage({
      chain: "ethereum",
    });
    console.log("FILEFIELFIE", file);
    // const id = file.embedUrl.match(/[-\w]{25,}(?!.*[-\w]{25,})/)[0]
    // console.log('IDIDIDID', id)
    const requestOptions = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    };
    const requestData = {
      driveId: file.id,
      role: role,
      token: token,
      connectedServiceId: connectedServiceId,
      accessControlConditions: accessControlConditions,
      authSig,
    };

    try {
      const response = await asyncHelpers.share(requestData, requestOptions);
      const { data } = response;
      const accessControlConditions = data["authorizedControlConditions"];
      const uuid = data["uuid"];
      const chain = accessControlConditions[0].chain;
      const authSig = await getAuthSig();
      const resourceId = {
        baseUrl: API_HOST,
        path: "/google/l/" + uuid,
        orgId: "",
        role: role.toString(),
        extraData: "",
      };

      window.litNodeClient.saveSigningCondition({
        accessControlConditions,
        chain,
        authSig,
        resourceId,
      });

      setAccessControlConditions([]);
      setSnackbarInfo({
        message: `New link created and copied to clipboard.`,
        severity: "success",
      });
      setOpenSnackbar(true);
      await navigator.clipboard.writeText(FRONT_END_HOST + "/google/l/" + uuid);
      await getAllShares(authSig);
    } catch (err) {
      console.log(`'Error sharing share', ${err}`);
      setSnackbarInfo({
        message: `'Error sharing share', ${err}`,
        severity: "error",
      });
      setOpenSnackbar(true);
    }
  };

  const handleDeleteShare = async (shareInfo) => {
    try {
      await asyncHelpers.deleteShare(shareInfo.id);
      await getAllShares(storedAuthSig);
      setSnackbarInfo({
        message: `${shareInfo.name} has been deleted.`,
        severity: "success",
      });
      setOpenSnackbar(true);
    } catch (err) {
      console.log(`'Error deleting share', ${err}`);
      setSnackbarInfo({
        message: `'Error deleting share', ${err}`,
        severity: "error",
      });
      setOpenSnackbar(true);
    }
  };

  const getLinkFromShare = async (linkUuid) => {
    setSnackbarInfo({
      message: `Link has been copied to clipboard.`,
      severity: "info",
    });
    setOpenSnackbar(true);
    await navigator.clipboard.writeText(
      FRONT_END_HOST + "/google/l/" + linkUuid
    );
  };

  if (!storedAuthSig.sig) {
    return (
      <section>
        <p>Login with your wallet to proceed.</p>
        <Snackbar
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
          open={openSnackbar}
          autoHideDuration={4000}
          onClose={handleCloseSnackbar}
        >
          <Alert severity={snackbarInfo.severity}>{snackbarInfo.message}</Alert>
        </Snackbar>
      </section>
    );
  }

  if (token === "") {
    return (
      <section>
        <Button onClick={() => authenticate("google")}>
          Connect your Google account
        </Button>
        <Snackbar
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
          open={openSnackbar}
          autoHideDuration={4000}
          onClose={handleCloseSnackbar}
        >
          <Alert severity={snackbarInfo.severity}>{snackbarInfo.message}</Alert>
        </Snackbar>
      </section>
    );
  }

  return (
    <section className={"service-grid-container"}>
      <div className={"service-grid-header"}>
        <ServiceHeader
          serviceName={"Google Drive App"}
          oauthServiceProvider={"Google"}
          currentUser={currentUser}
          signOut={signOut}
        />
      </div>
      <div className={"service-grid-links"}>
        <GoogleLinks
          className={"service-links"}
          serviceName={"Drive"}
          handleOpenProvisionAccessDialog={handleOpenProvisionAccessDialog}
          handleEditLinkAction={() => console.log("EDIT CLICKED")}
          handleCopyLinkAction={(linkUuid) => getLinkFromShare(linkUuid)}
          handleDownloadLinkAction={() => console.log("DOWNLOAD CLICKED")}
          handleDeleteLinkAction={(linkUuid) => handleDeleteShare(linkUuid)}
          listOfShares={allShares}
        />
      </div>
      <GoogleProvisionAccessModal
        handleCancelProvisionAccessDialog={handleCancelProvisionAccessDialog}
        accessControlConditions={accessControlConditions}
        removeAccessControlCondition={removeAccessControlCondition}
        setAccessControlConditions={setAccessControlConditions}
        humanizedAccessControlArray={humanizedAccessControlArray}
        handleAddAccessControl={handleAddAccessControl}
        handleGetShareLink={handleGetShareLink}
        accessToken={token}
        authSig={storedAuthSig}
        file={file}
        setFile={setFile}
        role={role}
        setRole={setRole}
        roleMap={googleRoleMap}
        openProvisionAccessDialog={openProvisionAccessDialog}
        setOpenProvisionAccessDialog={setOpenProvisionAccessDialog}
      />
      {openShareModal && (
        <ShareModal
          showStep="ableToAccess"
          className={"share-modal"}
          show={false}
          onClose={() => setOpenShareModal(false)}
          sharingItems={[{ name: file.embedUrl }]}
          onAccessControlConditionsSelected={async (restriction) => {
            await addToAccessControlConditions(restriction);
            setOpenShareModal(false);
            setOpenProvisionAccessDialog(true);
          }}
        />
      )}

      <Snackbar
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        open={openSnackbar}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
      >
        <Alert severity={snackbarInfo.severity}>{snackbarInfo.message}</Alert>
      </Snackbar>
    </section>
  );
}
