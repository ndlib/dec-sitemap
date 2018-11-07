const https = require('https')
const fse = require('fs-extra')
const rp = require('request-promise')

const COLLECTION_URL = 'https://collections.library.nd.edu/'

const d = new Date()
const now = d.toISOString()

// Clean up and create output directory
const outputDir = './sitemap'

if (fse.existsSync(outputDir)) {
  fse.removeSync(outputDir)
  console.log(`Deleted old directory: ${outputDir}`)
}

fse.mkdirSync(outputDir)
console.log(`Created new directory: ${outputDir}`)

const formatEntry = (entry, change, freq, image) => {
  let imageMarkUp = ''
  if(image) {
    imageMarkUp = `\r\n    <image:image><image:loc>${image}</image:loc></image:image>`
  }
  return `  <url>\r\n    <loc>${entry}</loc>\r\n    <changefreq>${change}</changefreq><priority>${freq}</priority>`
  + `<lastmod>${now}</lastmod>${imageMarkUp}\r\n  </url>\r\n`
}

const get = (url, handleFunction, fileStream) => {
  return rp(url)
    .then(function(response) {
      handleFunction(response, fileStream)
    })
    .catch(function(error) {
      console.log(`error: ${error}`)
    })
}


const getCollections = () => {
  get('https://honeycomb.library.nd.edu/v1/collections', handleCollections)
}

const handleCollections = (body) => {
  const collections = JSON.parse(body)
  const sitemapIndex = fse.createWriteStream(`${outputDir}/sitemap-index.xml`, { encoding: 'utf8'})
  sitemapIndex.write('<?xml version="1.0" encoding="UTF-8"?>\r\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\r\n')

  let promises = []
  for( const index in collections) {
    const honeycombURL = collections[index]['@id']
    const entry = formatEntry(`${COLLECTION_URL}${collections[index].id}/${collections[index].slug}`, 'daily', '1.0')
    const filename = `sitemap-${collections[index].slug}.xml`

    const collectionStream = fse.createWriteStream(`${outputDir}/${filename}`, { encoding: 'utf8'})
    collectionStream.write('<?xml version="1.0" encoding="UTF-8"?>\r\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
      + 'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\r\n')
    collectionStream.write(entry)
    const pageEntries = get(`${honeycombURL}/pages`, handlePages, collectionStream)
    const showcaseEntries = get(`${honeycombURL}/showcases`, handleShowcases, collectionStream)
    const itemEntries = get(`${honeycombURL}/items`, handleItems, collectionStream)
    promises.push(Promise.all([pageEntries, showcaseEntries, itemEntries]).then(function(result) {
      collectionStream.write('</urlset>')
      collectionStream.end()
      console.log(`Saved file ${filename}`)
      // Add new sitemap file to the index file
      sitemapIndex.write(`  <sitemap>\r\n    <loc>${COLLECTION_URL}sitemap/${filename}</loc>\r\n    <lastmod>${now}</lastmod>\r\n  </sitemap>\r\n`)
    }))
  }
  Promise.all(promises).then(function() {
    sitemapIndex.write('</sitemapindex>')
    sitemapIndex.end()
    console.log('Saved file sitemap-index.xml')
    console.log('Done.')
  })
}
const handlePages = (body, fileStream) => {
  let entries = []
  const obj = JSON.parse(body)
  const collectionId = obj.id
  const collectionSlug = obj.slug
  const pages = obj.pages
  for(index in pages) {
    const url = `${COLLECTION_URL}${collectionId}/${collectionSlug}/pages/${pages[index].id}/${pages[index].slug}`
    const entry = formatEntry(url, 'weekly', '0.5')
    entries.push(entry)
  }
  fileStream.write(entries.join(''))
}
const handleShowcases = (body, fileStream) => {
  let entries = []
  const obj = JSON.parse(body)
  const collectionId = obj.id
  const collectionSlug = obj.slug
  const showcases = obj.showcases
  for(index in showcases) {
    const url = `${COLLECTION_URL}${collectionId}/${collectionSlug}/showcases/${showcases[index].id}/${showcases[index].slug}`
    const entry = formatEntry(url, 'weekly', '0.9')
    entries.push(entry)
  }
  fileStream.write(entries.join(''))
}
const handleItems = (body, fileStream) => {
  let entries = []
  const obj = JSON.parse(body)
  const collectionId = obj.id
  const collectionSlug = obj.slug
  const items = obj.items
  for(index in items) {
    const url = `${COLLECTION_URL}${collectionId}/${collectionSlug}/items/${items[index].id}`
    let img
    if(items[index].media && items[index].media['@id']) {
      if(items[index].media['@type'] === 'ImageObject') {
        img = encodeURI(items[index].media['@id'])
      }

    }
    const entry = formatEntry(url, 'weekly', '0.5', img)
    entries.push(entry)
  }
  fileStream.write(entries.join(''))
}


getCollections()
