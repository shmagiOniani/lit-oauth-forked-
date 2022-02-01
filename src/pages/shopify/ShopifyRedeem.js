import React, { useEffect, useState } from "react";
import { useAppContext } from "../../context";
import {
  Alert,
  Button,
  Card,
  CardActions,
  CardContent,
  CircularProgress,
  Snackbar,
  TextField,
  Select,
  MenuItem,
  Tooltip, FormControl, InputLabel
} from "@mui/material";
import { setUpRedeemDraftOrder, redeemDraftOrder, getAccessControl } from "./shopifyAsyncHelpers";
import "./ShopifyRedeem.scss";
import LitJsSdk from "lit-js-sdk";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

import { litMatrixShirtStub, litMatrixShirtDraftOrder } from "../../stubData/litMatrixShirtStub";

const BASE_URL = process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST;

const loadingStatus = {
  loading: 'Loading...',

}

const ShopifyRedeem = () => {
  const { performWithAuthSig } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState(null);

  const [draftOrderId, setDraftOrderId] = useState(null);
  const [draftOrderDetails, setDraftOrderDetails] = useState(null);
  const [storedAuthSig, setStoredAuthSig] = useState(null);
  const [connectedToLitNodeClient, setConnectedToLitNodeClient] = useState(false);
  const [accessVerified, setAccessVerified] = useState(false);
  const [humanizedAccessControlConditions, setHumanizedAccessControlConditions] = useState(null);

  const [selectedProductVariant, setSelectedProductVariant] = useState('');
  const [variantMenuOptions, setVariantMenuOptions] = useState('');
  const [selectedVariantMenuOption, setSelectedVariantMenuOption] = useState('');

  document.addEventListener('lit-ready', function (e) {
    setConnectedToLitNodeClient(true);
  }, false)

  useEffect(() => {
    if (!connectedToLitNodeClient) {
      connectToLitNode();
    }
    if (!draftOrderId && connectedToLitNodeClient) {
      const queryString = window.location.search;
      const queryParams = new URLSearchParams(queryString);
      const id = queryParams.get('id');
      setDraftOrderId(id);
      // window.history.replaceState(null, null, window.location.pathname);
      signIntoLit();
    }
  }, [draftOrderId, connectedToLitNodeClient])

  useEffect(() => {
    if (!!storedAuthSig && !accessVerified) {
      // TODO: comment back in
      callSetUpRedeemDraftOrder();

      // TODO: for local dev, delete after use
      // setAccessVerified(true);
      // setLoading(false);
      // setProduct(litMatrixShirtStub);
      // setDraftOrderDetails(litMatrixShirtDraftOrder);
      // formatSelectMenuOptions(litMatrixShirtStub);
    }
  }, [storedAuthSig])

  useEffect(() => {
    if (selectedVariantMenuOption.length) {
      console.log('Selected Menu Option', selectedVariantMenuOption)
      const selectedVariant = product.variants.find(v => v.option1 === selectedVariantMenuOption)
      console.log('SelectedVariant', selectedVariant)
      setSelectedProductVariant(selectedVariant);
    }
  }, [selectedVariantMenuOption])

  const connectToLitNode = async () => {
    let litNodeClient = new LitJsSdk.LitNodeClient();
    await litNodeClient.connect();
    window.litNodeClient = litNodeClient;
  }

  const signIntoLit = async () => {
    await performWithAuthSig(async (authSig) => {
      if (!storedAuthSig || !storedAuthSig["sig"]) {
        console.log("Stop auth if authSig is not yet available");
      }
      setStoredAuthSig(authSig);
    })
  }

  const checkForPromotionAccessControl = async () => {
    try {
      console.log('Check for Promo - start')
      const resp = await getAccessControl(draftOrderId);
      console.log('Check for promo getAccessControl', resp.data);
      setHumanizedAccessControlConditions(resp.data.humanizedAccessControlConditions);
      console.log('check get Access Control resp', resp.data)
      return provisionAccess(resp.data.parsedAcc).then(jwt => {
        return jwt;
      });
    } catch (err) {
      // ADD_ERROR_HANDLING
      setLoading(false);
      console.log('Share not found:', err)
    }
  }

  const provisionAccess = async (accessControlConditions) => {
    const chain = accessControlConditions[0].chain;
    const resourceId = {
      baseUrl: process.env.REACT_APP_LIT_PROTOCOL_OAUTH_API_HOST,
      path: "/shopify/l/" + draftOrderId,
      orgId: "",
      role: "customer",
      extraData: "",
    };
    try {
      const jwt = await window.litNodeClient.getSignedToken({
        accessControlConditions: accessControlConditions,
        chain: chain,
        authSig: storedAuthSig,
        resourceId: resourceId
      });

      return jwt;
    } catch (err) {
      console.log('Error getting JWT:', err)
      return null;
    }
  }

  const callSetUpRedeemDraftOrder = async () => {
    checkForPromotionAccessControl().then(async (jwt) => {
      console.log('JWT', jwt)
      try {
        const resp = await setUpRedeemDraftOrder(draftOrderId, jwt);
        console.log('--> data in setUpDO', resp.data)
        setProduct(resp.data.product);
        setDraftOrderDetails(resp.data.draftOrderDetails);
        formatSelectMenuOptions(resp.data.product);
        setAccessVerified(true);
        setLoading(false);
      } catch (err) {
        // ADD_ERROR_HANDLING
        setLoading(false);
        console.log('Error creating draft order:', err)
      }
    }).catch(err => {
      // ADD_ERROR_HANDLING
      setLoading(false);
      console.log('Error provisioning access:', err);
    })
  }

  const formatSelectMenuOptions = (product) => {
    const mappedVariantRows = product.variants.map((p) => {
      return p.option1
    })
    setVariantMenuOptions(mappedVariantRows);
  }

  const callRedeemDraftOrder = async () => {
    checkForPromotionAccessControl().then(async (jwt) => {
      console.log('JWT in redeem draft order', jwt)
      try {
        const resp = await redeemDraftOrder(draftOrderId, selectedProductVariant, jwt);
        console.log('Check redeem draft order', resp.data)
        // window.location.href = resp.data.redeemUrl;
        setLoading(false);
      } catch (err) {
        // ADD_ERROR_HANDLING
        setLoading(false);
        console.log('Error creating draft order:', err)
      }
    }).catch(err => {
      // ADD_ERROR_HANDLING
      setLoading(false);
      console.log('Error provisioning access:', err);
    })
  }

  const getSubmitTooltip = () => {
    if (!accessVerified) {
      return 'Please sign in to wallet.';
    } else if (!selectedProductVariant) {
      return 'Please select a product.';
    } else {
      return 'Click to redeem access.';
    }
  }

  return (
    <div className={"full-container"}>
      <div>
        <div className={'access-service-background'}/>
        <section className={'access-service-card-container'}>
          <Card className={'access-service-card'}>
            <CardContent className={'shopify-service-card-header'}>
            <span className={'access-service-card-header-left'}>
              <h1>Token Access Verification</h1>
            </span>
              <span className={'access-service-card-header-right'}>
              <a href={'https://litprotocol.com/'} target={'_blank'} rel="noreferrer"><p>Powered by<span
                className={'lit-gateway-title'}>Lit Protocol</span><OpenInNewIcon/></p></a>
            </span>
            </CardContent>
            <CardContent className={'redeem-service-card-content'}>
              <div className={"center-content"}>
                {((!storedAuthSig || !accessVerified && loading)) && (
                  <div>
                    <CircularProgress className={"spinner"}/>
                    <p>Signing in.</p>
                  </div>
                )}
                {(storedAuthSig && !accessVerified && !loading) && (
                  <div>
                    <p>Sorry, you do not qualify for this promotion.</p>
                    <p>The conditions for access were not met.</p>
                    <p>{humanizedAccessControlConditions}</p>
                  </div>
                )}
                {storedAuthSig && accessVerified && !loading &&
                !!product && !!draftOrderDetails && (
                  <div className={'product-information-container'}>
                    <div className={'product-information-left'}>
                      <img className={"product-image"} src={product.images[0].src}/>
                    </div>
                    <div className={'product-information-center'}>
                      <span className={'product-detail'}>
                        <p
                          className={'product-attribute-label'}>{draftOrderDetails.value === 0 ? `Exclusive Access` : 'Discount'}</p>
                        {draftOrderDetails.value !== 0 && (
                          <p className={'product-discount'}>{draftOrderDetails.value}% off full price</p>)}
                      </span>
                      <span className={'product-conditions'}>
                        <p className={'product-attribute-label'}>Requirement:</p>
                        <p className={'product-condition'}>{humanizedAccessControlConditions}</p>
                      </span>
                      {!!variantMenuOptions && (
                        <FormControl fullWidth>
                          <InputLabel>Select a product</InputLabel>
                          <Select value={selectedVariantMenuOption} label={'Select a product'}
                                  onChange={(e) => setSelectedVariantMenuOption(e.target.value)}
                          >
                            {variantMenuOptions.map((v, i) => (
                              <MenuItem key={i} value={v}>{product.title} - {v}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      )}
                    </div>
                    <div className={'product-information-right'}>
                      <p>
                        {product.vendor} is using wallet verification to provide token-access based discounts.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
            <CardActions className={'redeem-card-actions'} style={{ padding: '0' }}>
              {storedAuthSig && accessVerified && !loading && (
                <Tooltip title={getSubmitTooltip()} placement="top">
                  {/*<span className={"access-service-card-launch-button"} onClick={async () => {*/}
                  <div>
                    <Button disabled={!selectedProductVariant} variant={"contained"} className={"redeem-button"}
                            onClick={async () => {
                              await callRedeemDraftOrder()
                            }}>
                      {!selectedProductVariant ? 'Select a Product' : 'Redeem Promotion'}
                      {/*<svg width="110" height="23" viewBox="0 0 217 23" fill="none" xmlns="http://www.w3.org/2000/svg">*/}
                      {/*  <path d="M0.576416 20.9961H212.076L184.076 1.99609" stroke="white" strokeWidth="3"/>*/}
                      {/*</svg>*/}
                    </Button>
                  </div>
                </Tooltip>
              )}
            </CardActions>
          </Card>
          {/*<Snackbar*/}
          {/*  anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}*/}
          {/*  open={openSnackbar}*/}
          {/*  autoHideDuration={4000}*/}
          {/*  onClose={handleCloseSnackbar}*/}
          {/*>*/}
          {/*  <Alert severity={snackbarInfo.severity}>{snackbarInfo.message}</Alert>*/}
          {/*</Snackbar>*/}
        </section>
      </div>
    </div>

  )
}

export default ShopifyRedeem;
