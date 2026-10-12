import { ZaloApiError } from "../Errors/ZaloApiError.js";
import { apiFactory } from "../utils.js";
export const getGroupInfoFactory = apiFactory()((api, _, utils) => {
    const serviceURL = utils.makeURL(`${api.zpwServiceMap.group[0]}/api/group/getmg-v2`);
    /**
     * Get group information
     *
     * @param groupId Group ID or list of group IDs
     *
     * @throws ZaloApiError
     */
    return async function getGroupInfo(groupId) {
        if (!Array.isArray(groupId))
            groupId = [groupId];
        if (groupId.length === 0) {
            return {
                removedsGroup: [],
                unchangedsGroup: [],
                gridInfoMap: {},
            };
        }
        const CHUNK_SIZE = 25;
        if (groupId.length <= CHUNK_SIZE) {
            const params = {
                gridVerMap: JSON.stringify(groupId.reduce((acc, id) => {
                    acc[id] = 0;
                    return acc;
                }, {})),
            };
            const encryptedParams = utils.encodeAES(JSON.stringify(params));
            if (!encryptedParams)
                throw new ZaloApiError("Failed to encrypt message");
            const response = await utils.request(serviceURL, {
                method: "POST",
                body: new URLSearchParams({
                    params: encryptedParams,
                }),
            });
            return utils.resolve(response);
        }
        // Tự động chia nhỏ mảng group IDs để tránh lỗi Zalo 114 (Tham số không hợp lệ khi gửi > 25/50 nhóm)
        const chunks = [];
        for (let i = 0; i < groupId.length; i += CHUNK_SIZE) {
            chunks.push(groupId.slice(i, i + CHUNK_SIZE));
        }
        const mergedResult = {
            removedsGroup: [],
            unchangedsGroup: [],
            gridInfoMap: {},
        };
        const results = await Promise.allSettled(chunks.map(async (chunk) => {
            const params = {
                gridVerMap: JSON.stringify(chunk.reduce((acc, id) => {
                    acc[id] = 0;
                    return acc;
                }, {})),
            };
            const encryptedParams = utils.encodeAES(JSON.stringify(params));
            if (!encryptedParams)
                throw new ZaloApiError("Failed to encrypt message");
            const response = await utils.request(serviceURL, {
                method: "POST",
                body: new URLSearchParams({
                    params: encryptedParams,
                }),
            });
            return utils.resolve(response);
        }));
        for (const res of results) {
            if (res.status === "fulfilled" && res.value) {
                if (res.value.gridInfoMap) {
                    Object.assign(mergedResult.gridInfoMap, res.value.gridInfoMap);
                }
                if (Array.isArray(res.value.removedsGroup)) {
                    mergedResult.removedsGroup.push(...res.value.removedsGroup);
                }
                if (Array.isArray(res.value.unchangedsGroup)) {
                    mergedResult.unchangedsGroup.push(...res.value.unchangedsGroup);
                }
            }
        }
        return mergedResult;
    };
});
