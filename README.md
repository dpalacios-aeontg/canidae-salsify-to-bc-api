# Getting Started

## BigCommerce `.env` variables
- Replace `<STORE_HASH>`in `WEBDAV_URL` with your BigCommerce store's hash.
- You can find your WebDAV username and password by going to _**Settings -> File Access (WebDAV)**_

## Salsify `.env` variables
- Replace `<ORGANIZATION_ID>` with your organizations ID. It can be found by logging into Salsify and getting the string following `/orgs/` in the URL.
- The `SALSIFY_API_KEY` can be found by going to your My _**Profile -> API Access**_

# How it works
This script:
1. Establishes a connection to the BigCommerce store's WebDAV in order to download a local copy of the master `ingredients.json` file.
2. It then generates a request composed of a series of filters in order to look up product IDs in Salsify. The product IDs to look for come from an array in the local `products.json` file.
3. If products are found they are looped over and each iteration extracts necessary information to create a BigC-ready product JSON file.

The script will log an ingredient name and the product it belongs to in the event it is not found in the the master `ingredients.json` file.