const https = require('https')
const fs = require('fs')
const rimraf = require('rimraf')

const COLLECTION_URL = 'https://collections.library.nd.edu/'

const d = new Date()
const now = d.toISOString()

// Clean up and create partials directory
const mkdir = () => {
  fs.mkdirSync(partialDir)
  console.log(`Created new directory: ${partialDir}`)
}
const partialDir = './partials'
if (fs.existsSync(partialDir)){
  rimraf(partialDir,  () => {
    console.log(`Deleted old directory: ${partialDir}`)
    mkdir()
  })
}
else {
    mkdir()
}

const formatEntry = (entry, change, freq, image) => {
  let imageMarkUp = ''
  if(image) {
    imageMarkUp = `<image:image><image:loc>${image}</image:loc></image:image>`
  }
  return `<url><loc>${entry}</loc><changefreq>${change}</changefreq><priority>${freq}</priority><lastmod>${now}</lastmod>${imageMarkUp}</url>
  `
}

const get = (url, handleFuction) => {
  const request = https.get(
    url,
    (response) => {
      let body = ""
      response.on(
        "data",
        (chunk) => {
          body += chunk
      })
      response.on(
        "end",
        () => {
          if(response.statusCode === 200) {
            try {
              handleFuction(body)
            } catch(error) {
              console.log(`error: ${error}`)
            }
          }
          else {
            console.log(`error: ${response.statusCode}`)
          }
        }
      )
    }
  )
}


const getCollections = () => {
  get('https://honeycomb.library.nd.edu/v1/collections', handleCollections)
}

const handleCollections = (body) => {
  let entries = []
  const collections = JSON.parse(body)
  for( const index in collections) {
    const honeycombURL = collections[index]['@id']
    const entry = formatEntry(`${COLLECTION_URL}${collections[index].id}/${collections[index].slug}`, 'always', '1.0')
    const pageEntries = get(`${honeycombURL}/pages`, handlePages)
    const showcaseEntries = get(`${honeycombURL}/showcases`, handleShowcases)
    const itemEntries = get(`${honeycombURL}/items`, handleItems)
    entries.push(entry)
  }
  write(entries.join(''))
}
const handlePages = (body) => {
  let entries = []
  const obj = JSON.parse(body)
  const collectionId = obj.id
  const collectionSlug = obj.slug
  const pages = obj.pages
  for(index in pages) {
    const url = `${COLLECTION_URL}${collectionId}/${collectionSlug}/pages/${pages[index].id}/${pages[index].slug}`
    const entry = formatEntry(url, 'daily', '0.5')
    entries.push(entry)
  }
  write(entries.join(''))
}
const handleShowcases = (body) => {
  let entries = []
  const obj = JSON.parse(body)
  const collectionId = obj.id
  const collectionSlug = obj.slug
  const showcases = obj.showcases
  for(index in showcases) {
    const url = `${COLLECTION_URL}${collectionId}/${collectionSlug}/showcases/${showcases[index].id}/${showcases[index].slug}`
    const entry = formatEntry(url, 'daily', '0.9')
    entries.push(entry)
  }
  write(entries.join(''))
}
const handleItems = (body) => {
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
    const entry = formatEntry(url, 'daily', '0.7', img)
    entries.push(entry)
  }
  write(entries.join(''))
}

let count = 0
const write = (entries) => {
  const collectionsSitemapEntry = fs.writeFile(
    `${partialDir}/sitemap-${count++}.xml`,
    entries,
    (error) => {
      if(error) {
        return console.log(error);
      }
      console.log(`${count} files saved.`);
    }
  )
}


getCollections()
