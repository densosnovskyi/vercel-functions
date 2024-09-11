import formidable from "formidable";
import { randomBytes } from "crypto";
import { EID, JWKWallet, arDriveFactory } from "ardrive-core-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { promises as fsPromises } from "fs";

import {
  ByteCount,
  FileInfo,
  UnixTime,
  DataContentType,
  ArFSDataToUpload,
  encryptedDataSize,
  EntityMetaDataTransactionData,
} from "ardrive-core-js";

// Ardrive code setup
export type CustomMetaDataGqlTags = Record<string, string | string[]>;
export type CustomMetaDataJsonFields = EntityMetaDataTransactionData;
export type CustomMetaDataTagInterface = CustomMetaDataGqlTags;

export interface CustomMetaData {
  /** Include custom metadata on MetaData Tx Data JSON */
  metaDataJson?: CustomMetaDataJsonFields;
  /** Include custom metadata on MetaData Tx GQL Tags */
  metaDataGqlTags?: CustomMetaDataGqlTags;
  /** Include custom metadata on File Data Tx GQL Tags */
  dataGqlTags?: CustomMetaDataTagInterface;
}

const maxFileSize = new ByteCount(2_147_483_646);
type BaseName = string;

export class ArFSBufferToUpload extends ArFSDataToUpload {
  constructor(
    private readonly buffer: Buffer,
    public readonly mime: string,
    public readonly fileName: string,
    public readonly customMetaData?: CustomMetaData
  ) {
    super();
    if (this.buffer.byteLength > +maxFileSize) {
      throw new Error(
        `Files greater than "${maxFileSize}" bytes are not yet supported!`
      );
    }
  }

  public get contentType(): DataContentType {
    return this.mime;
  }

  get lastModifiedDate(): UnixTime {
    const now = Date.now();
    return new UnixTime(now);
  }

  get size(): ByteCount {
    return new ByteCount(this.buffer.byteLength);
  }

  gatherFileInfo(): FileInfo {
    return {
      dataContentType: this.contentType,
      lastModifiedDateMS: this.lastModifiedDate,
      fileSize: this.size,
    };
  }

  getBaseName(): BaseName {
    return this.fileName;
  }

  getFileDataBuffer(): Buffer {
    return this.buffer;
  }

  public encryptedDataSize(): ByteCount {
    return encryptedDataSize(this.size);
  }
}

interface JWKInterface {
  kty: string;
  n: string;
  e: string;
  d: string;
  p: string;
  q: string;
  dp: string;
  dq: string;
  qi: string;
}

// Vercel setup
export const config = {
  api: {
    bodyParser: false, // Disable Vercel's default body parser
  },
};

// Cloud function
export default async function (req: VercelRequest, res: VercelResponse) {
  const FOLDER_ID = "c91885ed-bac4-4e54-8fec-f9fe9b9296e7";

  const form = formidable({
    keepExtensions: false,
    uploadDir: undefined,
    multiples: false,
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(400).json({ message: "Error parsing form data" });
    }

    const uniqueId = randomBytes(16).toString("hex");
    const file = files.file?.[0];
    const mime = fields?.mime?.[0] ?? file?.mimetype ?? "";
    const owner = fields?.owner?.[0] ?? "";
    const name = file?.originalFilename ?? uniqueId;
    console.log("C", file);
    const adminArweaveWalletKey =
      '{"d":"qli5TkqqdneMPEQOZp7ykA73M3a7p9W63umr4ESqF2eyT4B8DchBymE_ACEiKSaUabQDH6JvnsGUek9bD7gTdPsLgPz-UGKeKO_m8SSe35ZStajnpwlVAFzFJPV_U2erwsQK0p-6Nws2sQ4j4D9XHpT6IGnbhEd3hINu8_c4uMeDDtQZrT4d64sdhIRYUQo7vOQzGq97AF5A5h1snQmOYwSuN6rD7LeicsyZ1udF8zenVwURxTKlTUhhmiCc554okf1YSnMOOQFqV_b2EYZjZURD7-QXkV4BizYjddEIrcpz6TXZ7uycJdHDj-s52AErzo7r4OTd9gP38jExPCxzh3rg6E98RZzZkvrV9l3yvphtBdlBM6ojSQDT_dbxxB4ttkgZyuEQY-Xukkp7uXIZXz6mQZjrJ_uN1Bd6Lh5Aav-4G4krrvYlO36OBjzwraJgedDXiDS2e53bO-JcHwyoHmgZZK4MLjHxSevQGdFmkQCe7Ymgga-gOB9T0L8l2rFdmwzWvYp-UQP8WCttaY3nBQ0BaPUvcsdwy6-pHTeF2E75aOLS0sk6trVNN9386MCVlwZKxb19pLJajPzbZxsbtox3BoyW8INVT27xxc60kHScOkUQZJs6uuWVAeOqUo-Foi_MyCkJRwBCUOVKeqYqAd7rAr8pSKV-YiO3bUO_bbk","dp":"zb-vCtrAuJx3IbrQ3_FoAAXRSPCp2pqZjKzkNYBRKTIbRD6IarwxGKQBYibaB8OXSi53QOA2Dwcz82PFD-6RfRbNjYA3DZL4giFDVsf3nxOiXi0tOaWsYH0xrHaLUOIqfxHvzzpQfuySzmuv9bnQyxXK49J9L62VtZgIaRwS1t6Pj8y1vSOdeoJm2I-fZszSwaxck-irwD2q3EgXId1hKdEe3lrpDahbLCdt3HMzV5EeWFEHOlwwCnc_9Lz2KgoE9VWzXqGYTnqEMkSyrp-7zwr0OJDD6r1S7sdyI--xqLlQNUc0X1WFDCrcTcFofrhpQjyn_HDEOf88m-JHYg4y-Q","dq":"WePTnCMjw45EqY7CstbgzxU_x8ljXLAQE4pItHPkO-z5NpY6AdTmNeRafPGdJHognmEJ5fwYbdzKkwwnrvEIFDdFfLdCDIcZN8pi2cKJXzZ8UXGoOK_2a7G_uWBjKuILx_2M31hBGzTG-M1HCwEhijC8lOdeWyvxuXyf_2PHfI_VitWG3ipploXBFus3Cr-SysGOn44PR5uM2_w347Cx_FiJwurX3QbnqckeVEGu9NMP00dCQxhwZsqLUK87HTPo1JNAiWT2kyNgUT78Q_Tn62Xro8bAXpHzXxfK_IH49yvuW3uBind_aIzXwcG9_51Cp2s7v0abCKQ8iPkpKY2zVw","e":"AQAB","ext":true,"kty":"RSA","n":"uF-h3f_krQ__NFIdrqulmsQ-qrhOBeHvQIPRp3Z8nJcCQi1yiZ4XAIy-AUcCAD-TkMaX-PRdtf4Ty1ZZ2shr6ncrAGMHreqKslj2MzbW4peLQsKc8hcgXwyiitym-D8CGmOsgMHKdj3pUIXS1NWsIt8j1jqW0O1ZomZNlA41XSLXSHls_Jqq9J5pyZh2tOuLdch9CbSS8TQhYnSBZjVyKIqCYS9wWkm0ZCDPjRM4Ge6RFd9SdxVH5OXwaO1udAzezs8HtNwsAO24ZQi0jDsgQt24tfdl9ebw8yZ2qIyYP3-dugUPs4VJhzf6bSY25kT44iZ5pq-Pe-WGbMUvIAQgCVWqeJvIzfa6AY1ETSvdZt6RNPfIKXZM18ZqZSNyKvxLvvVBVU19OO_IQN7GYCmma827aJrXI_82WdCW3vV-Evh2YF79df8ez56y_WAX1FDXahiYvJdWXY5u1ALGdH4VKsPJLlP1OWbWuLsm2teqgA4xxZ8VpJkQQceAvJTwViIdonwr3GK6Gp5Kb2_oqiNffI5urx2vsZgG8OR7v_bS8PXfm4aXYqdns4f8BQDrVNsbBG0G_DzyQJA4FkrskZuPSuJA4XWdLNlBpKbkFYoQ4JEnl2aADv2lSqwtPh0l5y4PZRNnPSHbv2aMF20DxnPHxX2e9-WdUphLM44KKlZnvbc","p":"2-fFmDfTZGEXexPXh_ieUgD1FNudSMV54XMS5-Vf-Myf-jq4J39k2GrrtdqPS6HGj1vQM8z1_DspyRK2y4k0D26ON40Osellqi_eKpTn2z2WLkX4Q1iGoFdzBugCgKliPey9jEMqYYgNZ9__EhoHYpTe2Wdzh7S9Wxz5ZmWiixlExXoBy2r7TtB4N7zVSJp62rbFtdukn1KAck5R2qC_nEc1_yfeTVfAsW4JBHR2tsPL-CYBxINFSlHSk5BBwn7ML6OWCn3UKct08Z3owEIsxGKCW1on8aSxPFaK1vwKWwsNAvp80zoxMCMJx8Ma6Y0Fh8Ts3_sxd9POcqxORgMk1Q","q":"1qLYjjUbfkxQ64WOgShC_JPXkUerqlW5DfwQ9qaIJ6H03ABqenRFiAWZi4GB0wSgis1drmghmH_llZD6N9anPvYCCH6c3FDmjgKeGFtJBO7EvpbMATuen0oKyubssgvexv79zD7LROEZ4PF1KPAojDnHb_PLFVCtm9Sf1Ckj-kkWfmkOqynis_zTPuUvL28SXjmsPBKbH-pnImYhVYZ75E2yCg9qZIQAyjfVOGHaLJVja53RqpugckPwePomabQwngBT1nPcTAPf_sy0thzRyYdHtoZnhiw_P0uFobZZO7-Lqte1EOtuwmWmNGBKVKoI8RD6EDt9rNoKXUSQhS4OWw","qi":"vxp4mvhp-fPqvEn8L_N_33AWaCPxhsRUwssbDmrmP9l3BNnJ9JR0VSaU3oqu1hwiFLTSLzuzh7rG17kYhXTs65EehqyHfc72Xe-7FGiSiyvKGQQEl8NkkHvuTiXCCamNxiz3jXcVehyQlOFYeC0w-HaDbnLZapacSYrHGC42oR16n2neECE6sw9Yf6eiMxlqm6xSrMfctJC3VFt1xqLFsDsnJdSYMn10Pwhinswv1Zm2N8Sw4HRThwywX69n8RFuDLaoxwOzoDNrSmYx8ORAUvA-UBAIoZyBFDZbrDygRyDQpDyAT0-2KVe6bxsGD_5URJVHmiVu0-nD_2SMbxGqMw"}';

    const adminArweaveWalletJWK: JWKInterface = JSON.parse(
      adminArweaveWalletKey
    );

    const adminWallet = new JWKWallet(adminArweaveWalletJWK);

    const arDrive = arDriveFactory({ wallet: adminWallet });

    const destFolderId = EID(FOLDER_ID);

    const fileBuffer = await fsPromises.readFile(file?.filepath!);

    const uploadFileResult = await arDrive.uploadAllEntities({
      entitiesToUpload: [
        {
          wrappedEntity: new ArFSBufferToUpload(fileBuffer, mime, name, {
            metaDataJson: { ["Owner"]: owner },
            metaDataGqlTags: {
              ["Owner"]: [owner],
            },
          }),
          destFolderId,
        },
      ],
    });

    res.status(200).json(uploadFileResult.created[0].dataTxId);
  });
}
