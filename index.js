import 'dotenv/config';
import { AuthType, createClient } from 'webdav';
import { writeFile } from 'fs/promises'
import { join } from 'path';
import { fileURLToPath } from 'url';
import products from './products.json' assert { type: 'json' };

/**
 * 1. Sets up by retrieving ingredients.json master from Canidae WebDAV
 * 2. Passes product(s) to Salsify API to rerieve product information
 * 3. Generates JSON files for each product.
 */
async function main() {
  // Set up ENVs and WebDAV
  const {
    WEBDAV_URL,
    WEBDAV_USERNAME,
    WEBDAV_PASSWORD,
    SALSIFY_API_URL,
    SALSIFY_API_KEY,
  } = process.env;

  const client = createClient(WEBDAV_URL, {
    authType: AuthType.Auto,
    username: WEBDAV_USERNAME,
    password: WEBDAV_PASSWORD
  })

  // 1. Sets up by retrieving ingredients.json master from Canidae WebDAV
  const masterIngredientsBuffer = await client.getFileContents('/content/pdp/ingredients/ingredients.json');
  const masterIngredientsJsonString = masterIngredientsBuffer.toString('utf8');
  const masterIngredients = JSON.parse(masterIngredientsJsonString);

  // 2. Passes product(s) to Salsify API to rerieve product information
  const productFilters = [];

  const filterNames = [
    'Product ID (UPC)',
    'Individual Item #',
    '(FS) Individual Item #',
    'Case/Bale UPC',
    '(FS) Case/Bale UPC',
    'Old (Tuffy) Individual Item #'
  ];

  for (const filterName of filterNames) {
    for(const product of products) {
      productFilters.push(`='${filterName}':'${product}'`);
    }
  }

  const joinedProductFilters = productFilters.join('');

  const requestURL = new URL(SALSIFY_API_URL + '/products');
  requestURL.searchParams.append('filter', joinedProductFilters);

  const salsifyProducts = await fetch(requestURL.href, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SALSIFY_API_KEY}`
    }
  })
  .then(res => res.json())
  .then(({ data }) => data)
  .catch((error) => {
    console.error(error);
  });

  if(!salsifyProducts || salsifyProducts.length === 0) {
    return;
  }
  
  // 3. Generates JSON files for each product.
  for(const product of salsifyProducts) {
    const template = {
      'featured-ingredients': [],
      'full-ingredients': [],
      'guaranteed-analysis': [],
      'feeding-guidelines': {
          'for': '',
          'columns': [],
          'table_data': [
            []
          ]
      },
      'calorie-content': '',
      'aafco': ''
    }

    if(product['Featured Ingredients']?.length > 0){
      if(typeof product['Featured Ingredients'] === 'string') {
        template['featured-ingredients'] = product['Featured Ingredients'].split(',').map(ingredient => slugify(ingredient));
      } else {
        template['featured-ingredients'] = product['Featured Ingredients'].map(ingredient => slugify(ingredient));
      }

      // check if featured ingredients is an array
      if(Array.isArray(template['featured-ingredients'])) {
        template['featured-ingredients'].forEach(ingredient => {
          if(!masterIngredients.hasOwnProperty(ingredient)) {
            console.log(`FEATURED: ingredients.json is missing "${ingredient}" for Product: ${product['Product Name']}, UPC: ${product['Product ID (UPC)']}`);
          }
        });
      }
    }

    if(product['Ingredients']?.length > 0){
      template['full-ingredients'] = product['Ingredients'].split(',').map(ingredient => slugify(ingredient));

      if(Array.isArray(template['full-ingredients'])) {
        template['full-ingredients'].forEach(ingredient => {
          if(!masterIngredients.hasOwnProperty(ingredient)) {
            console.log(`FULL:     ingredients.json is missing "${ingredient}" for Product: ${product['Product Name']}, UPC: ${product['Product ID (UPC)']}`);
          }
        });
      }
    }

    if(product['Guaranteed Analysis']?.length > 0){
      template['guaranteed-analysis'] = product['Guaranteed Analysis']
        .split('%')
        .filter(item => item.length > 0)
        .map(item => item.trim() + '%')
        .map(item => {
          const splitString = item.split(')');
          return [
            splitString[0] + ')'.trim(),
            splitString[1].trim()
          ]
        });
    }

    if(product['Feeding Guidelines']?.length > 0){
      template['feeding-guidelines']['for'] = product['Feeding Guidelines'];
    }

    if(product['Calorie Content']?.length > 0){
      template['calorie-content'] = product['Calorie Content'];
    }

    if(product['Product Name']?.length > 0){
      if(product['Feeding Guide Pt. 3']?.length > 0){
        const aafcoStatementRaw = product['Feeding Guide Pt. 3'];
        const splitOnIsFormulated = aafcoStatementRaw.split('is formulated');
        if(splitOnIsFormulated.length > 1) {
          template['aafco'] = `<b>${splitOnIsFormulated[0].trim()}</b> is formulated ${splitOnIsFormulated[1].trim()}`;
        }
      }
    }

    // Write to JSON file in /output directory
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = join(__filename, '..');

    const productID = product['Product ID (UPC)'];
    const fileName = productID + '.json';
    const filePath = join(__dirname, 'output', fileName);
    const jsonString = JSON.stringify(template, null, 2);
  
    try {
      await writeFile(filePath, jsonString);
    } catch (err) {
      console.error(err);
    }
  }
}

main();

function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // remove non-word, non-whitespace, non-hyphen characters
    .replace(/[\s_-]+/g, '-') // replace whitespace, underscore, and hyphen characters with a single hyphen
    .replace(/^-+/, '') // trim leading hyphens
    .replace(/-+$/, '') // trim trailing hyphens
    .replace(/\(\)/g, ''); // replace parentheses with nothing
}