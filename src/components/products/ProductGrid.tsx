"use client";

import Image from "next/image";
import { FavoriteButton, StatusBadge } from "@/components/shared";

const SWATCHES = [
  "#111111",
  "#62616E",
  "#84818A",
  "#ABABAB",
  "#E8E8E8",
  "#4D2D1E",
  "#B39480",
  "#374067",
  "#3C69AD",
  "#676F57",
  "#3BB552",
  "#FCD240",
  "#ED9042",
  "#C23B4F"
];

const PRODUCTS = [
  {
    "id": "13:27972",
    "figmaLabel": "Cassina / Fauteuil Grand Confort, petit modèle (LC2)",
    "brand": "Cassina",
    "name": "Fauteuil Grand Confort, petit modèle (LC2)",
    "subtitle": "Cassina / Cassina / Ghế sofa",
    "component": "1:704",
    "status": "ĐANG CÓ HÀNG",
    "imageRef": "ff4721ac3c31f181f18ebf2b4d330495a7b3b75e",
    "imageUrl": "https://s3-alpha-sig.figma.com/img/ff47/21ac/3c31f181f18ebf2b4d330495a7b3b75e?Expires=1783296000&Key-Pair-Id=APKAQ4GOSFWCW27IBOMQ&Signature=MeSGrX4GCVFKBfCAwh9Nmye8TWRcdESilHHFY9LJNGzJhcZrcVcP9Xt1NRZjhLHvyALBWChzy9CFBuhi5ODyjDODfmKRKxA9-pQlidYwCzp0l086aJe2rv7FLXq9xJf9Dq192kpcRZnG-~1ZIo2Hs22vZES4i5A52h3DfFaOTuXCIFEShZT256DbK~7v-8mhDNi509YGljSDsr0N-Cz-IIrq~85rnkdgJc-pprVodfGPQSSZJzvHKt5xFeYNij8GR0J9yP5ghtcl5rcZxUg4pvjl1w4Glu~zpEGqUOtlzfqUYOItJtbU7gzk7ESUkPlLirapo6EFklKJwH8l66P8SA__",
    "oldPrice": null,
    "discount": null,
    "price": "10,000,000 vnđ"
  },
  {
    "id": "13:27973",
    "figmaLabel": "Cassina / Fauteuil Grand Confort, grand modèle (LC3)",
    "brand": "Cassina",
    "name": "Fauteuil Grand Confort, grand modèle (LC3)",
    "subtitle": "Cassina / Cassina / Ghế sofa",
    "component": "1:704",
    "status": "ĐANG CÓ HÀNG",
    "imageRef": "007438deac81317c5d490ee366be019202ccc4d6",
    "imageUrl": "https://s3-alpha-sig.figma.com/img/0074/38de/ac81317c5d490ee366be019202ccc4d6?Expires=1783296000&Key-Pair-Id=APKAQ4GOSFWCW27IBOMQ&Signature=UC9y7HYI~VAva5wvClzr7VH5ryQ0omNBeyPUAVIKEhoxrKdZIwwmdJBr31EL76Nul05PNA82Mc~lYsh1FGkNGEkSzhirpDFbHGXZpjC~Bipf5Ku-wcWe2b4SdVSH4eYkSTWVsqMZskogIstiQn9gPfu7Po~cLotatuzPz3~0Jb1teNCRC7GLkn8vkEzlOnsEjpt16DD829FcCFpABJnIctYXfxGFyXhkhr6kDGqz99-J0ZUxhhB7MX06myWjB04h4ljy27Sq4FwLmiZ0Sk4cZ19Se3hBl8XZeBwYmBEzEk7qyKkgU7JyMQwj~ifC~AsXvdcyTx21nDFQTcx005NmfQ__",
    "oldPrice": null,
    "discount": null,
    "price": "10,000,000 vnđ"
  },
  {
    "id": "13:27974",
    "figmaLabel": "Cassina / LC4 Chaise Longue",
    "brand": "Cassina",
    "name": "LC4 Chaise Longue",
    "subtitle": "Cassina / Sản phẩm",
    "component": "1:704",
    "status": "ĐANG CÓ HÀNG",
    "imageRef": "cd33ef939091d6dfff3ed4a7982c96af4c525489",
    "imageUrl": "https://s3-alpha-sig.figma.com/img/cd33/ef93/9091d6dfff3ed4a7982c96af4c525489?Expires=1783296000&Key-Pair-Id=APKAQ4GOSFWCW27IBOMQ&Signature=eZdIdljF4I23frffKkE8BG6DlmyokCtVm~OOHuMMawxA4x-oqsHnoiTxG2Mi2CUuplXyq5dmakCu5nTEhbf6VgkXj7RvoPMAHfKCEnIxjCdzoPmFLCdOmye-qgF6VgxTXfsQhhYVcwLR4TNUnreipiuLeDlEPGQUq549p6bnCRPHMkXOYKqlPw~fgc96Fm06Y4LNC3krczXVVP4aofcvsuA7CTt6qiOr~ICxZD8TsQNARu~5ADRxdAEJrcdCFpqBEXO5MAZJ2wWsOdY8m3nsGeP6MMDsTQw6kHetR0q8eJl1~d9ib38zeaePXCKRttzst4HvK-sow9efc2XfWSkSlQ__",
    "oldPrice": null,
    "discount": null,
    "price": "10,000,000 vnđ"
  },
  {
    "id": "13:27975",
    "figmaLabel": "B&B Italia / Husk Chair",
    "brand": "B&B Italia",
    "name": "Husk Chair",
    "subtitle": "B&B Italia / Sản phẩm",
    "component": "1:763",
    "status": "SALE",
    "imageRef": "0085c8e2511c521afbc8b70f8bdbc5e1ddac8b58",
    "imageUrl": "https://s3-alpha-sig.figma.com/img/0085/c8e2/511c521afbc8b70f8bdbc5e1ddac8b58?Expires=1783296000&Key-Pair-Id=APKAQ4GOSFWCW27IBOMQ&Signature=jhcHwlW8DzRZRt8AaxG-tQIxiHfFIjNOjoCE3qSseAXrwFDa7rjsP9lJKJCtjc-3f5mbmpq3jm-DxRUn3BLfbhcN6mss8ZfRTGw44Q9O1u5CvCDJevEvR49KEelk3IE9aKojwo58und7Gf~AnTGXNAdzq3rchznYMKVtWEluagE93PWkoLZ5uBTnFfBpYmc1IlPtsVVKWFxboqiPJ64-gyYUIT1UYdDL-JTW1gOI~RepXlFzkw-7fXYz7ncrhHi7068~hHP8lbfSSfLbHbmDg6dFRoSDERF06Q2LsxdWYPZ~zSN208gOhCkt3hg30PUlb8bA0lswygYd8RZg~jkMvg__",
    "oldPrice": "10,000,000 vnđ",
    "discount": "-20%",
    "price": "8,000,000 vnđ"
  },
  {
    "id": "13:27976",
    "figmaLabel": "Maxalto / Febo Chair",
    "brand": "Maxalto",
    "name": "Febo Chair",
    "subtitle": "Maxalto / Sản phẩm",
    "component": "1:763",
    "status": "SALE",
    "imageRef": "549bfc0460546bf9becfd08fb08196a9c142e4be",
    "imageUrl": "https://s3-alpha-sig.figma.com/img/549b/fc04/60546bf9becfd08fb08196a9c142e4be?Expires=1783296000&Key-Pair-Id=APKAQ4GOSFWCW27IBOMQ&Signature=VSFN0quPieEnpD3I-D-0fuFt4cN8zAWsNrQrohsoEPFcrdW3G5LLMbS1VAjRd8A1Qv5hB~HIPRDb-W3f6gFR7aROP9B9ErOhqI75Vg3bgA5iCdoZuzK3~FzyEMJtPnwBlU0-vnu~yBsdbZbl85K0B7kZEzNY0U8hwJnfazatrOiGe2FITdpxFa7~tVnDHWTTWRXJiqF~Pk6L4-KiSaqlColCadnjNS0jqvtbkQ3Gn5zuHif95Do1cHdKrcqsiJu9cZpomGInzseHpVY1GYX4tpxycGODfSI~Cf7tj5T96nnV1OlXinlu3EzXGoDne1xQnqKnUoMvf6pbHIaMexiJ7w__",
    "oldPrice": "10,000,000 vnđ",
    "discount": "-20%",
    "price": "8,000,000 vnđ"
  },
  {
    "id": "13:27977",
    "figmaLabel": "Maxalto / Febo Sofa",
    "brand": "Maxalto",
    "name": "Febo Sofa",
    "subtitle": "Maxalto / Sản phẩm",
    "component": "1:763",
    "status": "SALE",
    "imageRef": "e4bccd90a103ffb62636949b07d2a26739017e4d",
    "imageUrl": "https://s3-alpha-sig.figma.com/img/e4bc/cd90/a103ffb62636949b07d2a26739017e4d?Expires=1783296000&Key-Pair-Id=APKAQ4GOSFWCW27IBOMQ&Signature=sQn7qnSuYGaSj7TApiPvdNb4d-eCgmf3y0jgpNEmfJnthNA2pVU0Rfa9X-e-ipJpC6zMk65swKajzMwtZXsg5rOCfpbMVUKR5E9EuRG9jf7UUwyGASOc0MJ-ykiiAodf2Cl1h0OZjpBL-0WRoHBPUVvTFsUdysRje33OLiNL~vnF~UMhWucLKU36RIl6F8VW1vm9VJgTkocfMsSx6IENK1a9UGl1tKBkH0CDpKOFGSfE5i-5sbHxEfg1GlFH-HEv~bgWqati6ZAuMHTzu6vJT1LvUsBYFNZ~UegJOPf~soIh4VvBXbBs9w23PcfJ~4JariKbECy2WB5eRjBApciiSw__",
    "oldPrice": "10,000,000 vnđ",
    "discount": "-20%",
    "price": "8,000,000 vnđ"
  },
  {
    "id": "13:27978",
    "figmaLabel": "Maxalto / Amoenus Soft Sofa",
    "brand": "Maxalto",
    "name": "Amoenus Soft Sofa",
    "subtitle": "Maxalto / Maxalto / Ghế sofa",
    "component": "1:748",
    "status": "SẮP MỞ BÁN",
    "imageRef": "bd157386d92897c4592914f2f44d73b69d5c3370",
    "imageUrl": "https://s3-alpha-sig.figma.com/img/bd15/7386/d92897c4592914f2f44d73b69d5c3370?Expires=1783296000&Key-Pair-Id=APKAQ4GOSFWCW27IBOMQ&Signature=VoT0Iocp7zLlExENtdnPkUlNkwZtSFVSucg~NWPjOoC15qPATxXgN46khvixD2uDkTfpMoF0TnhvLO1b9EMugFPMDudqxy9YveE1HOWoZVZFT2tB~chJBJ~gm6QHawxwnVTY2WnXq47LCGvE29d1k~CQw7PwapHWh-CwTXSkcLerJ16V-X2vq8GeHJbEww7RAuAhthJccAw6ZR3f3Qud734SOZq9aXUdZfvAtcYaAkywuEdoeIjyupBHMiURf57bHfaG0xnnmKyfSC4k4HxS71hVNc4kOD~FQNSIXFH~j71vWVeroR18OVZAiMELRDr-giBEQlxq6xvJdE~Wg8JvPQ__",
    "oldPrice": null,
    "discount": null,
    "price": "10,000,000 vnđ"
  },
  {
    "id": "13:27979",
    "figmaLabel": "Fritz Hansen / Series 7 Chair",
    "brand": "Fritz Hansen",
    "name": "Series 7 Chair",
    "subtitle": "Fritz Hansen / Sản phẩm",
    "component": "1:748",
    "status": "SẮP MỞ BÁN",
    "imageRef": "122db835dcdc1b5aa94cf14f44134eb1d522047e",
    "imageUrl": "https://s3-alpha-sig.figma.com/img/122d/b835/dcdc1b5aa94cf14f44134eb1d522047e?Expires=1783296000&Key-Pair-Id=APKAQ4GOSFWCW27IBOMQ&Signature=r~BB4V4PUziMINoIswxAjjh1X6K~F35akE56fRpwFtG-HKpn00fZZU2gCzlGNz~tMk2gTysgDlV0H9AZnIIP6y8L8rgwcHyK4dMosiuwk38TG2yCn0CTPGZ45basxRdjVIvfKL7MmogQzqximCSx8bS30FWWgR5rdbM3o2x8XXsLmj7fp5zuq57hq~-gUbfLqnzuevpKHyeSOq0q4ha8GXwn4DFauaz9xr-QS5UHGYnhsliB66JmqnYBxyjBkQ7NgOTrCyMC5Ktgpuwo44-PSVU6ezjED-3ZEgsm8-QXVS9vqsOywSYdY34ue-wnzvvwprHdjAK32O0Atoibw9f5Xg__",
    "oldPrice": null,
    "discount": null,
    "price": "10,000,000 vnđ"
  },
  {
    "id": "13:27980",
    "figmaLabel": "Fritz Hansen / Swan Chair",
    "brand": "Fritz Hansen",
    "name": "Swan Chair",
    "subtitle": "Fritz Hansen / Sản phẩm",
    "component": "1:748",
    "status": "SẮP MỞ BÁN",
    "imageRef": "a98c3a3a307feb0c6bb4acf2fa4453b0a5bc8599",
    "imageUrl": "https://s3-alpha-sig.figma.com/img/a98c/3a3a/307feb0c6bb4acf2fa4453b0a5bc8599?Expires=1783296000&Key-Pair-Id=APKAQ4GOSFWCW27IBOMQ&Signature=AFLe~AoMgSkyxoc2Ftu0a18iDAp46jVQX7MXpYFBq7iQ1EhtNE5GPBc4l48Z1-PS7g5agi1roifybaBdhBGOogVBy3WR8Lcx2UpMnc24Kna1VPoyurI~wVURbPzLFJpPUA7C~7Mh6rRoyZJCP2m5oVLB1dBiPmAGh2QUG8uYQE08Cu~Re0kByrbB1AIoWFPWoSLsQldZAEskt~~1FNsTDwGpC2D7MqId-11x1TSKlFiRuN5JDhuO5fwmFYByFrAnXNSiEaz5LfSb4sgjA~njSgQy9Y7lL2UrniMhHJc0qh17EXq~RlFizLYesLF1593SSAumv6cVnTBw3PB-UgC7cw__",
    "oldPrice": null,
    "discount": null,
    "price": "10,000,000 vnđ"
  },
  {
    "id": "13:27981",
    "figmaLabel": "Cassina / Utrecht Armchair",
    "brand": "Cassina",
    "name": "Utrecht Armchair",
    "subtitle": "Cassina / Cassina / Ghế bành",
    "component": "1:704",
    "status": "ĐANG CÓ HÀNG",
    "imageRef": "dc5abb81937342d44dbe8b33dd3266612c432b2a",
    "imageUrl": "https://s3-alpha-sig.figma.com/img/dc5a/bb81/937342d44dbe8b33dd3266612c432b2a?Expires=1783296000&Key-Pair-Id=APKAQ4GOSFWCW27IBOMQ&Signature=lJjuhpIkwGDZ8Ydkljcg2ZZzLyArDrZrGm7FCiH9unYtDNYgDx3pnLYMWFcO~D2EEYSauI-ytbqLGEX7iGau051MDZlcgHHegb07-x0UsnIHUvxKMhsTEMo5ZWb3gho0SawiUTkGeCUGVOMcrtQkNPao0jIdMn3R4jVB9jIe1jmRt37A2utIz0HP-laobiAmrI-V15pNaSAJW50x7LuHscTosHNuCmEN3D9t9XbsENkjkj909aIu-P2gedDpH15bZO06GKsFGpiaf48AvlwIrUFBx-ji9Dp38NJc6JyElJCLsqEJ7vCTXH4Ab4z06PgpP0wZiJnzWyoyMXZz9sT5Ag__",
    "oldPrice": null,
    "discount": null,
    "price": "10,000,000 vnđ"
  },
  {
    "id": "13:27982",
    "figmaLabel": "Cassina / Cab Chair",
    "brand": "Cassina",
    "name": "Cab Chair",
    "subtitle": "Cassina / Cassina / Ghế ăn",
    "component": "1:704",
    "status": "ĐANG CÓ HÀNG",
    "imageRef": "68ea18bb3cf5584e9228c99e19b4d6aa1ec7b889",
    "imageUrl": "https://s3-alpha-sig.figma.com/img/68ea/18bb/3cf5584e9228c99e19b4d6aa1ec7b889?Expires=1783296000&Key-Pair-Id=APKAQ4GOSFWCW27IBOMQ&Signature=j9dtmA1cnzKI7rQgvsLnpRWD0UO510I7eOEDgfiPBa9~U7bpt03rbhwoPRBkDaDrzuNS2cFnKDpFtSbj1jF7e5uE9IvMGy5AMZxMELr2G~rfSt3vuv6Y7JGJVu4ebtTFWnmwjQENGSMEjH5wJ8VnsrE9QIFv8fOhdqQrpcrS7DXOZDrRzxEWxS1jS196ukTpQ~jphWpjhHLfr3XgYiZUtLsglkay7FC0VCI8Tr8tyoarz-gOrYZlHlDJSYbzBs3EIdKINL~Sr5fOu0Gopa~iMcpP8iqclFov2nwJ3e6zZtFzytl40aRPgbpEiPSl3WksgJxe6eQEtGBDam5ZaAZp6w__",
    "oldPrice": null,
    "discount": null,
    "price": "10,000,000 vnđ"
  },
  {
    "id": "13:27983",
    "figmaLabel": "B&B Italia / Camaleonda Sofa",
    "brand": "B&B Italia",
    "name": "Camaleonda Sofa",
    "subtitle": "B&B Italia / Sản phẩm",
    "component": "1:704",
    "status": "ĐANG CÓ HÀNG",
    "imageRef": "173d427a059434892183ab826528f8a27fc559c4",
    "imageUrl": "https://s3-alpha-sig.figma.com/img/173d/427a/059434892183ab826528f8a27fc559c4?Expires=1783296000&Key-Pair-Id=APKAQ4GOSFWCW27IBOMQ&Signature=SMXpgD1gyWx1fPX1thEIf9DygVLSjw9ylqSbBIiIXK~N8Y86wvnumRTj9eKg3sh1aWJvbWSjAbedcxUla2bJluiZbOD3UXLT4NkkEhPsK51MUlKbeu-eA-gQ7iFFXN1FFrOHTj8nh17K5s7d2AuGSqKV0xDhA-T2-BImNfZKrdn59qPYm2a1S012B9dz~IG5G3jUWx3p09l4aVvKwMP0aaKhIC3URf34Y7RTF2~jdCL4xBZd2lnRwMz9M68GZbMXFhUVXm4sxeD13Poaoq5rHD9pN5RisdyuZ3nf8xvxHOVz-8XPfNhBOr5MvoHqRpWZpl5MvHU~EjDtjDnVVnW8nQ__",
    "oldPrice": null,
    "discount": null,
    "price": "10,000,000 vnđ"
  },
  {
    "id": "13:27984",
    "figmaLabel": "Fritz Hansen / PK22 Chair",
    "brand": "Fritz Hansen",
    "name": "PK22 Chair",
    "subtitle": "Fritz Hansen / Sản phẩm",
    "component": "1:704",
    "status": "ĐANG CÓ HÀNG",
    "imageRef": "9027dd1e1b0c29bc0c5fb35594d06ca7aef9d760",
    "imageUrl": "https://s3-alpha-sig.figma.com/img/9027/dd1e/1b0c29bc0c5fb35594d06ca7aef9d760?Expires=1783296000&Key-Pair-Id=APKAQ4GOSFWCW27IBOMQ&Signature=KgG~gB3gUuAFOgK4uChoU~h-lehtCxfFURS85HcArogsFXBslweFGm~qlFTQJDiUZgedYpR8pJYEpkl72JPW3KHg9ucI28f1AoFjZJhs9CFKfazb6axJODw73yRLzPCcmowVTN9oehcvYS0Z~xe7diE9gCdpb-nE36cr2bHyCULlVS56c25j6WubUaiKO39wjUuyDe56g1iBbIaDoYV0mas0TTS9S~BkAHBPOkTR4qWYaGmuwtJnclAyEcP2vuAwqsFi-0lt7xuNq6rOh9C2G79a80UTYIscgLdbTt8btDrze83kTQ-UeX0q3IwMW9NvoJteTPoVUqJeIPwh-oeqNg__",
    "oldPrice": null,
    "discount": null,
    "price": "10,000,000 vnđ"
  },
  {
    "id": "13:27985",
    "figmaLabel": "Vitra / Panton Chair Classic",
    "brand": "Vitra",
    "name": "Panton Chair Classic",
    "subtitle": "Vitra / Vitra / Ghế ăn",
    "component": "1:704",
    "status": "ĐANG CÓ HÀNG",
    "imageRef": "b8846986dfd4ad6519401429394e92a5444c7877",
    "imageUrl": "https://s3-alpha-sig.figma.com/img/b884/6986/dfd4ad6519401429394e92a5444c7877?Expires=1783296000&Key-Pair-Id=APKAQ4GOSFWCW27IBOMQ&Signature=DeNJQAfZLJdnuiHN4L3i5E4yvskM5WD3ZtV9Angl26OtQKlN0SEiam5xa1gHZJY7jz8gKqQxoXi~ZQCOdxfaRIsAy88F7kk2s80o9DDK8RNnGeq0KqdpxHAn5HiLq9yhXDLXZe9zS0WdEtJg7Jgl-yro9joPtblKpH7qTfx-0sE5RgXkDYlrVeJmb6KQyNyYbk83kHld0EbRjf1fvCo0rS~DeB-JCglfHvxXogSCuTN-YSHAZotUrXnXoyPVnM03sZuT-SW-Zs8k1ZXm4Q0L7Ub7hOICCxe~REbpSVPHj-A43UKZRjdx0Qa1XEcM-xUA7uLJtRF7YzjnZFl5ij-t-Q__",
    "oldPrice": null,
    "discount": null,
    "price": "10,000,000 vnđ"
  },
  {
    "id": "13:27986",
    "figmaLabel": "Vitra / Eames Lounge Chair",
    "brand": "Vitra",
    "name": "Eames Lounge Chair",
    "subtitle": "Vitra / Vitra / Ghế thư giãn",
    "component": "1:704",
    "status": "ĐANG CÓ HÀNG",
    "imageRef": "f466fb7873ef2e8e555349a64dbda024e51551a6",
    "imageUrl": "https://s3-alpha-sig.figma.com/img/f466/fb78/73ef2e8e555349a64dbda024e51551a6?Expires=1783296000&Key-Pair-Id=APKAQ4GOSFWCW27IBOMQ&Signature=ZBwZmQMxctGtt6L-CJv2O2AAJ-VdnDJB5XnfqhlNg45yKEAPspjCa9FYLwCSpa1DwqVjGCdjBXY4VYX3TlyDA1cM1rpH79b8UmLoiBx2leNyh3uW~dpw4W-9NtalfCvGD4G7H~sz8c1jXnDlYn3fp5myVsHz0z8Mg-iCc6GG77zvqMf3UrpkvwFqyN1S~u4G4FCBXXYB9r3uHKtix9TlU4P07mUPcBVp9QEzreE5lQiWLwMDmTTcfmesUhlDJL26C9qyLckkFPP0PEq16vql9BBOfrFTMG1aun4e1YcqssrQdrSiSYnsGSLECeVGd3ZNoYXh5d4BDtryyTzSX1xucw__",
    "oldPrice": null,
    "discount": null,
    "price": "10,000,000 vnđ"
  },
  {
    "id": "13:27987",
    "figmaLabel": "Hết hàng / Vitra / Eames Plastic Chair",
    "brand": "Vitra",
    "name": "Eames Plastic Chair",
    "subtitle": "Vitra / Vitra / Ghế ăn",
    "component": "1:704",
    "status": "HẾT HÀNG",
    "imageRef": "65eac743489e695a64c946763351bb2230d07936",
    "imageUrl": "https://s3-alpha-sig.figma.com/img/65ea/c743/489e695a64c946763351bb2230d07936?Expires=1783296000&Key-Pair-Id=APKAQ4GOSFWCW27IBOMQ&Signature=EjdvjA9kQyA-YBhCqDJ~7EznNXM4-9-eU9WIRZNuBUjf1BHnldCEiKCn3o5a051HZZ~HrasnGPNgXu0tPaIWm1wNVAMrmEfT3lQ4w8q4hMx16Xfpf3DRrQ~ZqNi6gw4SW7W~fa3FoN8TcVEUb1A5czsw8gNpeHUnLqcaQP6SMhFYGOQswmUPXCa7Uuz~z5NCQ4vc4Wv6cJbR3rcyf8dNn6V~Al2PERoKglgE8Sw1yUHg~SQC~pMmGxq6rq0r42JRCmRcKMl78EA218-5Y~bmNErLKTLCJ96JE5UWQ6JnYgKASJn6hXY2oGbfl8zGTzrhNldl~1u1IqyGxmX~qZFKVA__",
    "oldPrice": null,
    "discount": null,
    "price": "10,000,000 vnđ"
  },
  {
    "id": "13:27988",
    "figmaLabel": "Vitra / Akari 1A Light Sculpture",
    "brand": "Vitra",
    "name": "Akari 1A Light Sculpture",
    "subtitle": "Vitra / Vitra / Đèn bàn",
    "component": "1:704",
    "status": "ĐANG CÓ HÀNG",
    "imageRef": "64f2dab40b1ed0d3d9cd7bc966bc71655aaf55ac",
    "imageUrl": "https://s3-alpha-sig.figma.com/img/64f2/dab4/0b1ed0d3d9cd7bc966bc71655aaf55ac?Expires=1783296000&Key-Pair-Id=APKAQ4GOSFWCW27IBOMQ&Signature=L1KGX1WVjtZsq3ZjTrYBXUSGx46GzsN26K7vTwiESIDI0Pl1sbYgeRoT6-kUCSHKeizyHcPPwng7zTkcFByqvIGt5bHhOLWCipLqGRmIKRZ7WrcOnSckHLjvEPe6X1a6ci6-GVnCx4bitPYQbX75KiwA0WK~2bRSjm0ymouAQOJALHjsuhgL79~Pp5lyQLaGovlpsE0Ze5goFHebFfczbTFdEhcCY~N4ZzkyWOtcEbE91yBVMqYE9EDJ1GcTTdGjsnPQdXqyCfZYXxlUfgBfS~Lb6f20gz6E7wILoXEseYBiGbEN~rlKAbEciTGtUm3EWh0LWp1LSmNHiYyS~u6SQw__",
    "oldPrice": null,
    "discount": null,
    "price": "10,000,000 vnđ"
  },
  {
    "id": "13:27989",
    "figmaLabel": "Vitra / Standard Chair",
    "brand": "Vitra",
    "name": "Standard Chair",
    "subtitle": "Knoll / Vitra / Ghế ăn",
    "component": "1:704",
    "status": "ĐANG CÓ HÀNG",
    "imageRef": "04f6701c4b7cd781cccb79db56dd5e123166fa32",
    "imageUrl": "https://s3-alpha-sig.figma.com/img/04f6/701c/4b7cd781cccb79db56dd5e123166fa32?Expires=1783296000&Key-Pair-Id=APKAQ4GOSFWCW27IBOMQ&Signature=qRoKPUkr3fQOGaj7DsedR4A7aWyE0K7NkYJGUeq0fqd3qmSyS684OYJ64saU586cnQc-CVKBMxw9~oEXmBb28U0QYAXMQ7DYTo1-iXJ4a9YzdZ8cddgUSY~HULUyAmSBmxMfbWRCh6af7UWndfgL0UibuXM8aJcu8mRghHvsDXlDplJ2jDkoRA4y0PofPbTjHwenLWDQeRrhAtxE6Xx4dpxetdHL0wxDcsZRxckVHt76ps~F~yPWNiy75pesESdjIxO~lca7bKfnlXevoCP6qk0BGYvYOUQ4qIwhaWgKeJGJbtsW8RewsqQ9jkuhGCdzaA9uexmNTGShzuuJxSnrAg__",
    "oldPrice": null,
    "discount": null,
    "price": "10,000,000 vnđ"
  },
  {
    "id": "13:27990",
    "figmaLabel": "Knoll / Womb Chair",
    "brand": "Knoll",
    "name": "Womb Chair",
    "subtitle": "Knoll / Knoll / Ghế thư giãn",
    "component": "1:704",
    "status": "ĐANG CÓ HÀNG",
    "imageRef": "8ce01f6673a249494a7a097d6db021548020ae3b",
    "imageUrl": "https://s3-alpha-sig.figma.com/img/8ce0/1f66/73a249494a7a097d6db021548020ae3b?Expires=1783296000&Key-Pair-Id=APKAQ4GOSFWCW27IBOMQ&Signature=N8dyh7CaxuzQQaxqTygUYQCykiH~T8j142n2zIbqzcxa4zf358p1tf4XhRmDjG28zhFGsCZBL1JI~U13cI728AfKP9YfyezrimS1Lym0XuiohQT3U3VNvdQWa6aP0C8RK7T~Y5H0VaupvmPbYtIBw~NgP1siB31CLHVFAKmPjD9SWYgwPLGHsHSmdyWnrchjrzTkWqRR8A16tefbn2lswSBnkA~9Tf1KHdrVoPMnk2aZ-sWut218dRzbMWzinjj7NcI5BUv99jFVNctTylm6IX6EJ-i1usgrkKJ2ebxlxjbgiAWPe804~jEX64jxjKw2qOqaY-pujMCEq0YbovZpxA__",
    "oldPrice": null,
    "discount": null,
    "price": "10,000,000 vnđ"
  },
  {
    "id": "13:27991",
    "figmaLabel": "Knoll / Platner Arm Chair",
    "brand": "Knoll",
    "name": "Platner Arm Chair",
    "subtitle": "Knoll / Knoll / Ghế ăn",
    "component": "1:704",
    "status": "ĐANG CÓ HÀNG",
    "imageRef": "bd6e464d8c0bc71ea331cad4510197c34bf5d437",
    "imageUrl": "https://s3-alpha-sig.figma.com/img/bd6e/464d/8c0bc71ea331cad4510197c34bf5d437?Expires=1783296000&Key-Pair-Id=APKAQ4GOSFWCW27IBOMQ&Signature=PBheAITmkSZBccKQaigpC3A9xhN~lzQarjbJrJLF4qVZj5LwtazPvqzhn5SGmXEGY6vX7HnWoXMjWzvnRIgCVzZZ4QTKmR25ZnHKJD~eOhnq2DM9izQlizveE3BHGWAKbAfXS1dwaMgYmRBxijthKYIT33XBuLW6lS8f78XXtgFTmvIIZodpeM2cqCjZtLfKzTk4u7BEYRrp5T4YeRsV6St38ObNM7BaQidxMNggWWKb~CiPOeoAICw61aQz0FGB7gCIm1Hx6umFz4c~0QlcvExRnn0ATAs5kkO4hwI1IEnR3DIUck1mIdkrEpVn5r79ZIjn07ukKyVFtQ0WK0T58w__",
    "oldPrice": null,
    "discount": null,
    "price": "10,000,000 vnđ"
  },
  {
    "id": "13:27992",
    "figmaLabel": "Knoll / Saarinen Tulip Table",
    "brand": "Knoll",
    "name": "Saarinen Tulip Table",
    "subtitle": "Knoll / Knoll / Bàn",
    "component": "1:704",
    "status": "ĐANG CÓ HÀNG",
    "imageRef": "87d5fbe2b7f532f3084a6fc00379f0be6a6822d0",
    "imageUrl": "https://s3-alpha-sig.figma.com/img/87d5/fbe2/b7f532f3084a6fc00379f0be6a6822d0?Expires=1783296000&Key-Pair-Id=APKAQ4GOSFWCW27IBOMQ&Signature=St7LOySxCBo9WBmIwEkig-GGvVdqcahvVZlb8lxopYpvQ3ctZYY3xXKGwdG~-~pGFFEZkeE2JaMRdhxP56Xm2jUVKjq6iwevjePT1q-egygPCKMdgIHSQG2PZDLRKRxZbHHKWZ01HZPGM5pEXXBK8vg7K2DwCbqXLzOSI4SoMoHyk8afNgGQBnNkjHOM~ILuPjKtY5-nHK7KscQ0GUvPUp6RPy8ANCETWDKdwMNYjijAaT4crTLJHWrKXR2BcNkqkQXv0bi3wUqqSTi5gWRrq9zyhTclcvVwzWxQNMRxY5sVMvZeIQ52R-osWqoovECdykBMY9okaoS2cRFwcmGgcg__",
    "oldPrice": null,
    "discount": null,
    "price": "10,000,000 vnđ"
  },
  {
    "id": "13:27993",
    "figmaLabel": "Knoll / Cesca Chair",
    "brand": "Knoll",
    "name": "Cesca Chair",
    "subtitle": "Knoll / Knoll / Ghế ăn",
    "component": "1:704",
    "status": "ĐANG CÓ HÀNG",
    "imageRef": "0d8e68c4d650ddd8b5972e8bea161b35def4a564",
    "imageUrl": "https://s3-alpha-sig.figma.com/img/0d8e/68c4/d650ddd8b5972e8bea161b35def4a564?Expires=1783296000&Key-Pair-Id=APKAQ4GOSFWCW27IBOMQ&Signature=SQeSbxZkcAXxh8GXLX8fOnzOo-V9dl8ZAH8Cam6uf8ccs5qGP5kxGUrQsopgIoZf1HzaIZgOYMuMhWrUClWd5xdBQI3va-PgWGG2LjqiWNkZ-3n322onHlUVxnBdCS5XTqANLOBh8UbQkZ14PXdmB6v3hL~XvkJvY-yLcrk4I0RM8Zjf25Rmu01WO-L-vWiqwcCsxCQDr-aq9ol5mdN~wn9ZMYRcfst~hVAiQAKjshheP94Zb5aC0KR7-Q8eIi8DC4NlvZm8p882PnHydnNUGjPVi1JFKW2d9Z1yuvXqinkLlFy9NSpMDa1h0Ks2jk3Lh9lOOxDLoTNB8WFreHmcYA__",
    "oldPrice": null,
    "discount": null,
    "price": "10,000,000 vnđ"
  },
  {
    "id": "13:27994",
    "figmaLabel": "Hết hàng / Louis Poulsen / PH 5 Pendant",
    "brand": "Louis Poulsen",
    "name": "PH 5 Pendant",
    "subtitle": "Louis Poulsen / Sản phẩm",
    "component": "1:704",
    "status": "HẾT HÀNG",
    "imageRef": "77bca4a6360bcc4c2fde9933d6dba673670d557b",
    "imageUrl": "https://s3-alpha-sig.figma.com/img/77bc/a4a6/360bcc4c2fde9933d6dba673670d557b?Expires=1783296000&Key-Pair-Id=APKAQ4GOSFWCW27IBOMQ&Signature=hpsVXTg~~JI5-tFqgpeLnmKJNhqcnl3t5ZMWk3HCLBMnOsSBvi9td75s~fAJvJUK-kNiEY1rn3uySVZuHx48N0ElU8NX4vvnUVD1wHXeMAlo7bqYSdDT07uM9k764D-8JTX-yxCkDC5l3U~a6SSBKJwreMQL-qixJBuECPLVZkAEwm-Ui6Lq1s3gXsVz~xIOQhM~Ch2SUuRl4wRNLr02iDAjRNxpUs1I1Y1rLDl6lAqobhRhPGvs~z5~-jxIBCaXd1uPnW0MJufHf9jguP9KdPZ9jG5EEKYbMu3o1SMpQAhW7Z4g6oeUAxrv0oE87l2yHlIVZsy3OMURgJN3HlYb1Q__",
    "oldPrice": null,
    "discount": null,
    "price": "10,000,000 vnđ"
  },
  {
    "id": "13:27995",
    "figmaLabel": "HAY / About A Chair AAC 22",
    "brand": "HAY",
    "name": "About A Chair AAC 22",
    "subtitle": "Fritz Hansen / HAY / Ghế ăn",
    "component": "1:704",
    "status": "ĐANG CÓ HÀNG",
    "imageRef": "04bd2067407ece28b10c07bb8661e88430562a37",
    "imageUrl": "https://s3-alpha-sig.figma.com/img/04bd/2067/407ece28b10c07bb8661e88430562a37?Expires=1783296000&Key-Pair-Id=APKAQ4GOSFWCW27IBOMQ&Signature=XM4krH8lgWXzac4~3AFgT1UkSlRjtRtAZ7LFzoFNrrNHbTanojSb0Mh3jlYHAEOmi6UbbeRzpJ2LYgAzS4gvJHUqENM1G-heE4e~Lz81n-2bVKtauOp7Gz3wuwD2MA45eVJocwpqffvYfhqe4BGgyVwYu5uXfPTBQGgzIHyRhiWQ7ZvCRU1kXYQ1bWnUL-2-3LOBOelTbtS2dWR1q04EniuORO-ogtlsPMYC0~xWMv6aRX6EwMHkflZVcdSjlGpLqI57lJSGJ24DmwkAim-JzLdzSRz2BoxoyVo5ts18nHkufH1MEbPZVG~AISrRFckK0RXA-QfwHndn5YtbBTdV7A__",
    "oldPrice": null,
    "discount": null,
    "price": "10,000,000 vnđ"
  },
  {
    "id": "13:27996",
    "figmaLabel": "HAY / Palissade Armchair",
    "brand": "HAY",
    "name": "Palissade Armchair",
    "subtitle": "HAY / Sản phẩm",
    "component": "1:704",
    "status": "ĐANG CÓ HÀNG",
    "imageRef": "12f93821d448f475cd05109f52e49e308bc27a1f",
    "imageUrl": "https://s3-alpha-sig.figma.com/img/12f9/3821/d448f475cd05109f52e49e308bc27a1f?Expires=1783296000&Key-Pair-Id=APKAQ4GOSFWCW27IBOMQ&Signature=UeU0kca8ZIELXN0rMpMpKN7vCS48E4DeKbyCX1dQkOArapns76yi5j3F7SB7BH~qGNxDgR2XeZ3-xl3sHV-IXxaty2giKxp91BW2xpdFSHLn~9dXumCXWd-gVTiF93Y8SSvHHgg-oMnSOGlSTcVgM-q8hRfy1cIum8LJVrwy4M3SeCwEQPIetx4YV60rOu6UpWmHZnAJXxLZ8HaIZIrO3tCLTfcpy6zPByWUVYwnsvBe0SX8VmBYeXtmfXuiV4g-XFrStwyxK1qh8xRoOCCiEVyo2U0URJpISjDPyYM69B4m62jbSOxMiyTDHDJDzP07aPxw9dqWMwe8dUYF5UF3zg__",
    "oldPrice": null,
    "discount": null,
    "price": "10,000,000 vnđ"
  },
  {
    "id": "13:27997",
    "figmaLabel": "Verpan / System 1-2-3 Chair",
    "brand": "Verpan",
    "name": "System 1-2-3 Chair",
    "subtitle": "USM / Verpan / Ghế ăn",
    "component": "1:704",
    "status": "ĐANG CÓ HÀNG",
    "imageRef": "c31e43e8d1b11a4c2bc30fdb8ced7c9bdfb4269b",
    "imageUrl": "https://s3-alpha-sig.figma.com/img/c31e/43e8/d1b11a4c2bc30fdb8ced7c9bdfb4269b?Expires=1783296000&Key-Pair-Id=APKAQ4GOSFWCW27IBOMQ&Signature=HE5l-7xLWRPTeWgKYRvZIgHecC0RMe~uUrUej-gz3VR4GJwiW44VUaENMPIphazLpsm-1XXr~SUX28KQCYwdmbd-VolbrQRUDVUxQqi9jp~13uiPkpMTB6btmuct9W6Z~druJlh80kn1oeSiDxoXFd1AFTg4YfnMyylmIY~9~nRGOIiQYJ6gWarqq7r5Sp4lGBdU-k7Dd7FItvY5XetvAThYpMD5rKYF6m8Cti2OJk55dattbcMiFyGpZtxJtLXJmEj5GAS0d8Of2R2CVVh8p17N95EFzcblSXAVppSHhMAFoXJSRn3cM99y0zOQ4N6WcQXDyN~~7gW9n~ATyuRDng__",
    "oldPrice": null,
    "discount": null,
    "price": "10,000,000 vnđ"
  },
  {
    "id": "13:27998",
    "figmaLabel": "USM / USM Haller Table",
    "brand": "USM",
    "name": "USM Haller Table",
    "subtitle": "Louis Poulsen / USM / Bàn",
    "component": "1:704",
    "status": "ĐANG CÓ HÀNG",
    "imageRef": "5b7994899ff20d243050229c1e7c2f37bae00cb7",
    "imageUrl": "https://s3-alpha-sig.figma.com/img/5b79/9489/9ff20d243050229c1e7c2f37bae00cb7?Expires=1783296000&Key-Pair-Id=APKAQ4GOSFWCW27IBOMQ&Signature=ZmMGkJFKPlOjOqcsQil~zUTC4a20dZe2uKRnLC-fIKc-aL1GvZJJhPTTOm3Hs1fmWC60cZ5f~ob8CaBq0XSQwFcUbqcHeJuFR6EEYPmYu~Nub2jHEID6fXsOr58Cu1~x-8h7w6Zvv6hb30hsqC3GOsEyl-BRXNT9W21Ze1TiUL12v5S~EfJ2mDLbBGKQZqx6b~IE1wENFy3B2HggaUkSBfFAxwbycfZjJJbkdP2285KzZ8oROEGxn~FUpRg2HxUw-ufOm-L5h30YfwEs--klEIOH1tDuocVL6aN4v829lyRb-01pp6SQ4xHon~IlhHgQDZ6Wj-zMgX1dqrYfiTtrCg__",
    "oldPrice": null,
    "discount": null,
    "price": "10,000,000 vnđ"
  },
  {
    "id": "13:27999",
    "figmaLabel": "Flos / Arco Floor Lamp",
    "brand": "Flos",
    "name": "Arco Floor Lamp",
    "subtitle": "Flos / Flos / Đèn sàn",
    "component": "1:704",
    "status": "ĐANG CÓ HÀNG",
    "imageRef": "427328df2f6d8aea89c40536c8b9212d2b74d93a",
    "imageUrl": "https://s3-alpha-sig.figma.com/img/4273/28df/2f6d8aea89c40536c8b9212d2b74d93a?Expires=1783296000&Key-Pair-Id=APKAQ4GOSFWCW27IBOMQ&Signature=s8sSrOTFMviYuvAaiYoGBr34gI3cZn6U43Ip1UsFvM6AQPfyGuQdQTPqmdU49~oEKfifuB4n6pJG03ZcVtm7kX27nnqzy1SaCHhdPdSl1zn6QMKNgom38PbOZD2raPPVDcp8dZg4QQLqSWLOoXrOq~OsZmT1FTfnQrtwuSx-KXoDTF8uMD6G5JCzKjglQrVbXqlVOm~K9-qS5u-MHkUQsoLRrP8yyk62Sxph99cJ6dZQMY72ioXkEWaVBJgC4Vi8QuosTC87i2y29Q7PCUJDQemP4lw11sYy0oGJ6cT9jqwVV2jMuqOVS9orurvitek5KH7Ms3Qy61kiMwfO26~~7w__",
    "oldPrice": null,
    "discount": null,
    "price": "10,000,000 vnđ"
  },
  {
    "id": "13:28000",
    "figmaLabel": "Flos / Snoopy Table Lamp",
    "brand": "Flos",
    "name": "Snoopy Table Lamp",
    "subtitle": "Flos / Flos / Đèn bàn",
    "component": "1:704",
    "status": "ĐANG CÓ HÀNG",
    "imageRef": "d48baf1e1534e7fc7580ae6d354d25ee2d00a879",
    "imageUrl": "https://s3-alpha-sig.figma.com/img/d48b/af1e/1534e7fc7580ae6d354d25ee2d00a879?Expires=1783296000&Key-Pair-Id=APKAQ4GOSFWCW27IBOMQ&Signature=Be~cgq7xAd8Mu~QwWzhg-XSUP2z23SVkIxRnT01738tl5u-WbxZi2RT--avYlC58By47hebfHTxo0LdTaRoTWBBjszw3ABCT2zfFZCZV8RlbwiEvIS6apBrsp2GoEuwA59bbMTEmruC0uekvbI6uogQik-Y-I2SZVkSelmBM6CDCNqmJ7hurCrlyGL2WIXN7KslqmzTMISSWExBDLGPCGSWxyIWdNUXnwLFwPA7czmhLhPVSjOdrlgtvD4lVgwJnTJXIiLFGhfKfVyESFy6lG0NInNFlX-DnwniKVLOA3HqXyr5NXnOJ1ZoPGN5BpTMPLwPqTPbwc86fJRprzdVqVg__",
    "oldPrice": null,
    "discount": null,
    "price": "10,000,000 vnđ"
  },
  {
    "id": "13:28001",
    "figmaLabel": "Nanoco / Nanoco LED Shop Light",
    "brand": "Nanoco",
    "name": "Nanoco LED Shop Light",
    "subtitle": "Nanoco / Sản phẩm",
    "component": "1:704",
    "status": "ĐANG CÓ HÀNG",
    "imageRef": "329bb93c7b802e98c30d6cc5cdf66445ea72f841",
    "imageUrl": "https://s3-alpha-sig.figma.com/img/329b/b93c/7b802e98c30d6cc5cdf66445ea72f841?Expires=1783296000&Key-Pair-Id=APKAQ4GOSFWCW27IBOMQ&Signature=cwTiDy6~Hr74RNc9FLGWhe7r0~rt~Kc3tI1nHDq944NtlpTqXZMPhl3uPsBOudIhF2xpSPpPo3bsepRknRV2bqv5L591nxKXuot2blwH9B2WamjyktCbhJ4eeOtw6Sq7VFXYWX3wYpRvgKxEp~lu~wEv6ec3sfar9GxzxYMGvHDb-whTLJxdNpCPiLgoVdWcvEG3s0EfGoaLy3ekmKvTtvZvZ5LeQyS2vbBdhYs5M1WtzIItzyQ4MHONFYCyDWEuNNGP3GOTemInDoadvdRYhyvOVHJsXoj5tbuaB2MbR4YuM-A1-gvqImdg3wG32kedPh76HNAn6DXOJSxmhy9~IQ__",
    "oldPrice": null,
    "discount": null,
    "price": "10,000,000 vnđ"
  },
  {
    "id": "13:28002",
    "figmaLabel": "Hết hàng / Nanoco / Nanoco Surface Mounted Panel Light",
    "brand": "Nanoco",
    "name": "Nanoco Surface Mounted Panel Light",
    "subtitle": "Nanoco / Sản phẩm",
    "component": "1:704",
    "status": "HẾT HÀNG",
    "imageRef": "65aab33bc0bc669fa51b17a281d60af88639f5ab",
    "imageUrl": "https://s3-alpha-sig.figma.com/img/65aa/b33b/c0bc669fa51b17a281d60af88639f5ab?Expires=1783296000&Key-Pair-Id=APKAQ4GOSFWCW27IBOMQ&Signature=LL1-UIPgxmydCBAhVT4fbhihxcRh6Jv2384F-G4H5P1JCGs5-Vw3Bjyhnm7DWo-VPpxObziEuohEKptvcK7w2w2hLZaGFxhgArt~bMr8d1jQHrO0zU-TeX~fS05UA9DihZwI6knHBjAYiL2zhIX5N3z8k7P8yP1xntWgZNaiGl0ohZfUB5r3Ipy9ZOsqyyp1lqMRdoJEV-aWpldhpPjFpePG2u4-iLqNGAJbZbW~myfHf8bmUWjp9V9PNt7Gkz3HbWCrPFI2LUsq4HpijH~swt-fJqDdLBlojJeevPwbGaSmnfDxnW5xt7O4PzS0cM6YYk70lI3NdJIOdHKnTi~YiQ__",
    "oldPrice": null,
    "discount": null,
    "price": "10,000,000 vnđ"
  },
  {
    "id": "13:28003",
    "figmaLabel": "STOFF Nagel / Nagel Candle Holder",
    "brand": "STOFF Nagel",
    "name": "Nagel Candle Holder",
    "subtitle": "STOFF Nagel / Sản phẩm",
    "component": "1:704",
    "status": "ĐANG CÓ HÀNG",
    "imageRef": "664a6d8abcfdec428e7d8f0e8e10ac5e374ba65d",
    "imageUrl": "https://s3-alpha-sig.figma.com/img/664a/6d8a/bcfdec428e7d8f0e8e10ac5e374ba65d?Expires=1783296000&Key-Pair-Id=APKAQ4GOSFWCW27IBOMQ&Signature=mrBlOV7tt4UyHpdnDJtHgFY7Hf1HYF4xOZUQ51jR~AvBxEQ0~aDv7Jot71C1KCOlFaSnXCLv2ML7j7lZ108eE8Jjvta79lwoOZDNE5ZT61RVUvzqrEva~H5dxWDGCJpDJuCos404WSCHcGHVszEHj8ev2LGBSf96SJCHJVsHnV32KDM2eBJUNE9Nz6hjNUCupNPDTXfKcgVb7sB2UKIDeoWPD8wlxzWrslNG5aWxvIc9a92vAoD6k~3HuXlpIguqSqOzjCxQVltnWRZ77hMqMw2qQii1x0s~AovZ3KOy0KaOHzABwa~k6BpyisVegN97ZnMwJhnGGT2gJ7pN6lCXVA__",
    "oldPrice": null,
    "discount": null,
    "price": "10,000,000 vnđ"
  }
] as const;

interface ProductGridProps {
  favorites: Set<number>;
  onToggleFavorite: (id: number) => void;
}

function getStatusType(status: string): "sale" | "instock" | "outofstock" {
  if (status === "SALE") {
    return "sale";
  }

  if (status === "ĐANG CÓ HÀNG") {
    return "instock";
  }

  return "outofstock";
}

function cleanSubtitle(subtitle: string, brand: string) {
  return subtitle.replace(`${brand} / ${brand} / `, `${brand} / `);
}

export function ProductGrid({ favorites, onToggleFavorite }: ProductGridProps) {
  return (
    <section className="grid grid-cols-1 gap-9 sm:grid-cols-2 xl:grid-cols-3">
      {PRODUCTS.map((product, index) => {
        const numericId = index + 1;
        const sale = product.status === "SALE";
        const statusType = getStatusType(product.status);

        return (
          <article
            className="group flex min-w-0 flex-col gap-6 bg-white p-4"
            key={product.id}
          >
            <div className="relative flex aspect-[4/3] w-full items-center justify-center bg-white p-4">
              {/* Favorite button — fades in on hover */}
              <FavoriteButton
                active={favorites.has(numericId)}
                className="absolute right-4 top-4 z-10 flex size-8 items-center justify-center rounded-full border border-nh-border bg-white opacity-100 transition-opacity duration-200 group-hover:shadow-sm"
                onToggle={() => onToggleFavorite(numericId)}
                size="sm"
                variant="outline"
              />
              <StatusBadge
                className="absolute left-4 top-4 z-10 rounded-none px-1 py-0.5 text-center text-[12px] leading-4"
                label={product.status}
                type={statusType}
              />
              <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[6px] transition-transform duration-300 group-hover:scale-[1.03]">
                <Image
                  alt={product.figmaLabel}
                  className="object-contain"
                  fill
                  sizes="(min-width: 1280px) 300px, (min-width: 640px) 45vw, 90vw"
                  src={product.imageUrl}
                  unoptimized
                />
              </div>
            </div>

            <div className="flex flex-col items-start gap-2 text-left">
              <div className="text-[13px] font-medium leading-4 text-nh-ink">
                {product.brand}
              </div>
              <h3 className="text-[16px] font-normal leading-6 text-nh-ink">
                {product.name}
              </h3>
              <p className="text-[12px] font-medium leading-4 text-nh-muted">
                {cleanSubtitle(product.subtitle, product.brand)}
              </p>
              <div className="mt-1 flex w-full items-center justify-between gap-1">
                {SWATCHES.map((swatch) => (
                  <span
                    className="size-3 shrink-0 border border-black"
                    key={swatch}
                    style={{ backgroundColor: swatch }}
                  />
                ))}
              </div>
              <div className="mt-2 flex flex-col items-center gap-1">
                {sale && product.oldPrice ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-normal leading-4 text-nh-muted line-through">
                      {product.oldPrice}
                    </span>
                    {product.discount ? (
                      <span className="bg-nh-red px-1.5 py-0.5 text-[12px] font-medium leading-4 text-white">
                        {product.discount}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <span className="text-[15px] font-semibold leading-5 text-nh-ink">
                  {product.price}
                </span>
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}
