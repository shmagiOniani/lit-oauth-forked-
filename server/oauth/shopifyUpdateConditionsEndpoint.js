import {
  makeShopifyInstance,
  updateProductWithTagAndUuid
} from "./shopifyHelpers/shopifyApiNodeHelpers.js";
import dotenv from "dotenv";

dotenv.config({
  path: "../../env",
});


const updateConditionTypes = (acc) => {
  const unifiedAccessControlConditions = [];
  let chainsUsed = [];
  let conditionTypes = [];
  for (let i = 0; i < acc.length; i++) {
    if (Array.isArray(acc[i])) {
      const updatedConditions = updateConditionTypes(acc[i]);
      unifiedAccessControlConditions.push(updatedConditions);
    } else if (!!acc[i] && !!acc[i]['operator']) {
      unifiedAccessControlConditions.push(acc[i]);
    } else {
      const accHolder = acc[i];
      if (!accHolder['conditionType']) {
        accHolder['conditionType'] = 'evmBasic';
        conditionTypes.push('evmBasic');
      } else {
        conditionTypes.push(...accHolder.conditionType.split(','));
      }

      chainsUsed.push(accHolder.chain);
      unifiedAccessControlConditions.push(accHolder);
    }
  }
  return {
    chainsUsed,
    conditionTypes
  };
}

const getAndUpdateOldOffers = async (fastify, allOffers) => {
  // let newOffers = [];
  // let oldOffers = [];
  // allOffers.forEach(o => {
  //   try {
  //     const parsedAssetId = JSON.parse(o.assetIdOnService);
  //     newOffers.push(o);
  //   } catch (err) {
  //     oldOffers.push(o);
  //   }
  // })
  //
  // if (!oldOffers.length) {
  //   return false;
  // }
  if (!allOffers.length) {
    return [];
  }

  const updatedOldOffers = allOffers.map(o => {
    let offerHolder = JSON.parse(JSON.stringify(o));
    console.log('o', o)

    // update access control conditions
    const parsedAcc = JSON.parse(o.accessControlConditions);
    const updatedUaccObj = updateConditionTypes(parsedAcc);

    // update assetIdOnService
    try {
      const checkAssetIdOnService = JSON.parse(o.assetIdOnService);
      offerHolder.assetIdOnService = o.assetIdOnService;
    } catch (err) {
      offerHolder.assetIdOnService = JSON.stringify([ o.assetIdOnService ]);
    }

    // update conditionTypes.  will always be evmBasic for v1 conditions
    offerHolder.conditionTypes = 'evmBasic';

    // update offerType.  will be same as assetType previously
    offerHolder.offerType = offerHolder.assetType;
    offerHolder.redeemedNfts = {};
    offerHolder.description = offerHolder.description ?? '';

    // update usedChains
    offerHolder['usedChains'] = updatedUaccObj.chainsUsed.join(',');

    const redeemedByHolder = JSON.parse(offerHolder.redeemedBy);
    let updatedRedeemedBy = {};
    updatedUaccObj.conditionTypes.forEach(c => {
      updatedRedeemedBy[c] = redeemedByHolder;
    })
    offerHolder.redeemedBy = JSON.stringify(redeemedByHolder);

    // update draftOrderDetails
    const parsedDraftOrderDetails = JSON.parse(o.draftOrderDetails);
    parsedDraftOrderDetails['conditionTypes'] = updatedUaccObj.conditionTypes.join(',');
    parsedDraftOrderDetails['hasRedeemLimit'] = parsedDraftOrderDetails['redeemLimit'] > 0;
    parsedDraftOrderDetails['id'] = [ parsedDraftOrderDetails.id ];
    parsedDraftOrderDetails['typeOfAccessControl'] = offerHolder.assetType;
    parsedDraftOrderDetails['typeOfRedeem'] = parsedDraftOrderDetails['redeemLimit'] > 0 ? 'walletAddress' : null;
    parsedDraftOrderDetails['usedChains'] = updatedUaccObj.chainsUsed.join(',');
    offerHolder.draftOrderDetails = JSON.stringify(parsedDraftOrderDetails);

    // update redeemType.  if draftOrder redeem limit is anything above 0, it will be limited by walletAddress
    offerHolder.redeemType = parsedDraftOrderDetails.redeemLimit > 0 ? 'walletAddress' : null;

    //update conditionType
    return offerHolder;
  })

  console.log('ALL OFFERS', allOffers)

  const shop = await fastify.objection.models.shopifyStores.query()
    .where("shop_id", "=", allOffers[0].shopId);

  const shopify = makeShopifyInstance(shop[0].shopName, shop[0].accessToken)

  const promisesUpdatedOldOffers = updatedOldOffers.map(async updated => {
    const patched = await fastify.objection.models.shopifyDraftOrders
      .query()
      .where('id', '=', updated.id)
      .patch({
        shop_id: updated.shopId,
        access_control_conditions: updated.accessControlConditions,
        humanized_access_control_conditions: updated.humanizedAccessControlConditions,
        active: updated.active,
        title: updated.title,
        asset_id_on_service: updated.assetIdOnService,
        asset_type: updated.assetType,
        user_id: updated.userId,
        draft_order_details: updated.draftOrderDetails,
        extra_data: updated.extraData,
        used_chains: updated.usedChains,
        description: updated.description,
        discount: updated.discount,
        summary: updated.summary,
        redeemed_by: updated.redeemedBy,
        redeemed_nfts: updated.redeemedNfts,
        asset_name_on_service: updated.assetNameOnService,
        offer_type: updated.offerType,
        condition_types: updated.conditionTypes,
        redeem_type: updated.redeemType
      });
    const parsedDraftOrderDetails = JSON.parse(updated.draftOrderDetails);

    let query = await fastify.objection.models.shopifyDraftOrders
      .query()
      .where("id", "=", updated.id);

    const snakeCaseQuery = {
      id: query[0].id,
      shop_id: query[0].shopId,
      access_control_conditions: query[0].accessControlConditions,
      humanized_access_control_conditions: query[0].humanizedAccessControlConditions,
      asset_id_on_service: query[0].assetIdOnService,
      title: query[0].title,
      summary: query[0].summary,
      asset_type: query[0].assetType,
      user_id: query[0].userId,
      draft_order_details: query[0].draftOrderDetails,
      extra_data: query[0].extraData,
      active: query[0].active,
      redeemed_by: query[0].redeemedBy,
      description: query[0].description,
      discount: query[0].discount,
      used_chains: query[0].usedChains,
      redeemed_nfts: query[0].redeemedNfts,
      condition_types: query[0].conditionTypes,
      asset_name_on_service: query.assetNameOnService,
      offer_type: parsedDraftOrderDetails.typeOfAccessControl,
      redeem_type: query.redeemType
    }

    const updatedMetadataAndTagRes = await updateProductWithTagAndUuid(shopify, snakeCaseQuery, shop[0]);

    return updatedMetadataAndTagRes;
  })

  const resolvedUpdatedOldOffers = await Promise.all(promisesUpdatedOldOffers);

  return resolvedUpdatedOldOffers;
}

export default async function shopifyUpdateConditionsEndpoint(fastify, opts) {
  fastify.post("/api/shopify/updateAllConditions", async (request, response) => {
    if (request.body.key !== process.env.ADMIN_KEY) {
      return 'nope';
    }

    let shops = [];
    if (request.body['shopId']) {
      shops = await fastify.objection.models.shopifyStores.query().where('shop_id', '=', request.body.shopId);
    } else {
      shops = await fastify.objection.models.shopifyStores.query();
    }

    const allShopsWithDraftOrders = shops.map(async s => {
      let draftOrderHolder = await fastify.objection.models.shopifyDraftOrders.query().where('shop_id', '=', s.shopId);
      return draftOrderHolder;
    })

    const resolvedAllShopsWithDraftOrders = await Promise.all(allShopsWithDraftOrders)
    console.log('resolvedAllShopsWithDraftOrders', resolvedAllShopsWithDraftOrders)
    const iterateThroughShops = resolvedAllShopsWithDraftOrders.map(async s => {
      const updateRes = await getAndUpdateOldOffers(fastify, s);
      return updateRes;
    })

    const resolvedShopIterations = await Promise.all(iterateThroughShops);

    return resolvedShopIterations;
  })

  fastify.post("/api/shopify/returnFormatToPrevious", async (request, response) => {
    const patchResponse = fastify.objection.models.shopifyDraftOrders.query()
      .where('id', '=', '25ccbc9b-4a39-4540-91bd-36cec4197064')
      .patch({
        "shop_id": "59835023511",
        "access_control_conditions": "[{\"conditionType\":\"evmBasic\",\"contractAddress\":\"0xA3D109E28589D2AbC15991B57Ce5ca461Ad8e026\",\"standardContractType\":\"ERC721\",\"chain\":\"polygon\",\"method\":\"balanceOf\",\"parameters\":[\":userAddress\"],\"returnValueTest\":{\"comparator\":\">=\",\"value\":\"1\"}}]",
        "humanized_access_control_conditions": "Owns at least 1 of 0xA3D109E28589D2AbC15991B57Ce5ca461Ad8e026 tokens",
        "asset_id_on_service": "gid://shopify/Product/7347665666199",
        "title": "test with new setup",
        "summary": "Token gated floral leaf",
        "asset_type": "exclusive",
        "user_id": "",
        "draft_order_details": "{\"id\":\"gid://shopify/Product/7347665666199\",\"quantity\":1,\"title\":\"test with new setup\",\"description\":null,\"price\":\"9.00\",\"redeemLimit\":\"0\",\"value\":0,\"valueType\":\"PERCENTAGE\"}",
        "extra_data": "evmBasic",
        "active": true,
        "redeemed_by": "{}",
        "description": null,
        "discount": null,
        "used_chains": null,
        "condition_types": null,
        "redeemed_nfts": null,
        "asset_name_on_service": null,
        "offer_type": null,
        "redeem_type": null,
      })
    return patchResponse;
  })

  fastify.post('/api/shopify/getAllMetafields', async (request, response) => {
    if (request.body.key !== process.env.ADMIN_KEY) {
      return 'nope';
    }

    console.log('request.body', typeof request.body)
    const {shopId} = request.body;
    console.log('SHop', shopId)
    const shop = await fastify.objection.models.shopifyStores.query()
      .where("shop_id", "=", shopId);

    const shopify = makeShopifyInstance(shop[0].shopName, shop[0].accessToken)

    const allDraftOrders = await fastify.objection.models.shopifyDraftOrders.query().where('shop_id', '=', request.body.shopId)
    let ids = [];
    allDraftOrders.forEach(draftOrder => {
      try {
        const idHolder = JSON.parse(draftOrder.assetIdOnService);
        idHolder.forEach(id => {
          const endHolder = id.split("/").pop();
          console.log('endHolder', endHolder)
          ids.push(endHolder)
        })
      } catch (err) {
        const endHolder = draftOrder.assetIdOnService.split("/").pop();
        ids.push(endHolder)
      }
    })

    // return ids;

    const allProductMetafieldPromises = ids.map(async id => {
      return await shopify.metafield.list({
        metafield: {
          owner_resource: 'product',
          owner_id: id
        }
      })
    })

    const resolvedAllProductMetafields = await Promise.all(allProductMetafieldPromises);

    return resolvedAllProductMetafields.flat();

    // const checkDelete = resolvedAllProductMetafields.flat().map(async meta => {
    //   return await shopify.metafield.delete(meta.id);
    // })
    //
    // const deleteChecked = await Promise.all(checkDelete);
    //
    // return deleteChecked;
  })

  fastify.post('/api/shopify/deleteAllMetafields', async (request, response) => {
    if (request.body.key !== process.env.ADMIN_KEY) {
      return 'nope';
    }

    console.log('request.body', typeof request.body)
    const {shopId} = request.body;
    console.log('SHop', shopId)
    const shop = await fastify.objection.models.shopifyStores.query()
      .where("shop_id", "=", shopId);

    const shopify = makeShopifyInstance(shop[0].shopName, shop[0].accessToken)

    const allDraftOrders = await fastify.objection.models.shopifyDraftOrders.query().where('shop_id', '=', request.body.shopId)
    let ids = [];
    allDraftOrders.forEach(draftOrder => {
      try {
        const idHolder = JSON.parse(draftOrder.assetIdOnService);
        idHolder.forEach(id => {
          const endHolder = id.split("/").pop();
          console.log('endHolder', endHolder)
          ids.push(endHolder)
        })
      } catch (err) {
        const endHolder = draftOrder.assetIdOnService.split("/").pop();
        ids.push(endHolder)
      }
    })

    // return ids;

    const allProductMetafieldPromises = ids.map(async id => {
      return await shopify.metafield.list({
        metafield: {
          owner_resource: 'product',
          owner_id: id
        }
      })
    })

    const resolvedAllProductMetafields = await Promise.all(allProductMetafieldPromises);

    // return resolvedAllProductMetafields.flat();

    const checkDelete = resolvedAllProductMetafields.flat().map(async meta => {
      return await shopify.metafield.delete(meta.id);
    })

    const deleteChecked = await Promise.all(checkDelete);

    return deleteChecked;
  })

}