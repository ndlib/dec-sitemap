const fse = require('fs-extra')
const rp = require('request-promise')
const robotsParser = require('robots-parser')

const COLLECTION_URL = 'https://collections.library.nd.edu/'
const FILE_HEADER = '<?xml version="1.0" encoding="UTF-8"?>\r\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
  + 'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\r\n'
const FILE_FOOTER = '</urlset>'
const ROBOTS_UA = 'Googlebot'

const d = new Date()
const now = d.toISOString()
let robots = null

// Clean up and create output directory
const outputDir = './sitemap'

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
      return handleFunction(response, fileStream)
    })
    .catch(function(error) {
      console.log(`error: ${error}`)
    })
}


const getCollections = (indexStream) => {
  return get('https://honeycomb.library.nd.edu/v1/collections', handleCollections, indexStream)
}

const handleCollections = (body, indexStream) => {
  const collections = JSON.parse(body)

  let promises = []
  for( const index in collections) {
    const collection = collections[index]
    const honeycombURL = collection['@id']
    const collectionPath = `${COLLECTION_URL}${collection.id}/${collection.slug}`

    if (robots && robots.isDisallowed(collectionPath, ROBOTS_UA)) {
      console.log(`Skipped ${collection.slug} (blocked in robots.txt)`)
      continue // Ignore this collection and don't make a sitemap file; Move on to the next collection
    }

    const entry = formatEntry(collectionPath, 'daily', '1.0')
    const filename = `sitemap-${collection.slug}.xml`

    const fileStream = fse.createWriteStream(`${outputDir}/${filename}`, { encoding: 'utf8'})
    fileStream.write(FILE_HEADER)
    fileStream.write(entry)

    const configUrl = collection['hasPart/metadataConfiguration']
    const configPromise = configUrl ? get(configUrl, function(body) { handleConfig(body, fileStream, collection) }) : Promise.resolve()
    const pageEntries = get(`${honeycombURL}/pages`, handlePages, fileStream)
    const showcaseEntries = get(`${honeycombURL}/showcases`, handleShowcases, fileStream)
    const itemEntries = get(`${honeycombURL}/items`, handleItems, fileStream)
    promises.push(Promise.all([configPromise, pageEntries, showcaseEntries, itemEntries]).then(function(result) {
      fileStream.write(FILE_FOOTER)
      fileStream.end()
      console.log(`Saved file ${filename}`)
      // Add new sitemap file to the index file
      indexStream.write(`  <sitemap>\r\n    <loc>${COLLECTION_URL}sitemap/${filename}</loc>\r\n    <lastmod>${now}</lastmod>\r\n  </sitemap>\r\n`)
    }))
    //break; // FOR TESTING: Break after first collection. Let's try not to slam honeycomb by generating all of them.
  }
  return Promise.all(promises)
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

const handleConfig = (body, fileStream, collection) => {
  const obj = JSON.parse(body)
  if (obj.hasAboutPage) {
    const url = `${COLLECTION_URL}${collection.id}/${collection.slug}/about`
    const entry = formatEntry(url, 'weekly', '0.5')
    fileStream.write(entry)
  }
  if (obj.enableBrowse) {
    const url = `${COLLECTION_URL}${collection.id}/${collection.slug}/search`
    const entry = formatEntry(url, 'weekly', '0.8')
    fileStream.write(entry)
  }
}


const writeAll = () => {
  const sitemapIndex = fse.createWriteStream(`${outputDir}/sitemap-index.xml`, { encoding: 'utf8'})
  sitemapIndex.write('<?xml version="1.0" encoding="UTF-8"?>\r\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\r\n')

  // Miscellaneous pages that are not fetched as part of collections. Not really likely to change.
  const entries = []
  entries.push(FILE_HEADER)
  entries.push(formatEntry(`${COLLECTION_URL}`, 'monthly', '1.0'))
  entries.push(FILE_FOOTER)
  const miscStream = fse.writeFileSync(`${outputDir}/sitemap-misc.xml`, entries.join(''), { encoding: 'utf8' })
  console.log('Saved file sitemap-misc.xml')

  getCollections(sitemapIndex)
    .then(function() {
      //Once all collections are done being written, then we can finish and close the index file
      sitemapIndex.write('</sitemapindex>')
      sitemapIndex.end()
      console.log('Saved file sitemap-index.xml')
      console.log('Done.')
    })
}

const process = () => {
  //Get robots.txt file so we know what routes should be excluded from sitemap
  rp('https://raw.githubusercontent.com/ndlib/beehive/master/public/robots.txt')
    .then(function(response) {
      robots = robotsParser(`${COLLECTION_URL}robots.txt`, response)
      console.log('Loaded robots.txt from ndlib/beehive/master')

      if (fse.existsSync(outputDir)) {
        fse.removeSync(outputDir)
        console.log(`Deleted old directory: ${outputDir}`)
      }

      fse.mkdirSync(outputDir)
      console.log(`Created new directory: ${outputDir}`)

      writeAll()
    })
    .catch(function(error) {
      console.error(`Error: Failed to retrieve robots.txt.`)
    })
}

process()
