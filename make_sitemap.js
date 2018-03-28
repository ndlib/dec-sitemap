const fs = require('fs');
const junk = require('junk')
const dir = './partials';
const concat = require('concat-files')

const top = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">'
const bottom = '</urlset>'

let sitemaps = []
fs.readdir(dir, (err, files) => {
  // ignore junk like .DS_Store
  files = files.filter(junk.not)

  files.forEach(file => {
    sitemaps.push(`./partials/${file}`)
  })
  concat(
    sitemaps, './partials/sitemap-temp.xml', (error) => {
    if (error) {
      return console.log(error)
    }
    else {
      fs.readFile('./partials/sitemap-temp.xml', 'utf8', (error, data) =>{
          if (error) {
            return console.log(error)
          }
          fs.writeFile(
            './sitemap.xml',
            `${top}${data}${bottom}`,
            (error) => {
              if(error) {
                return console.log(error)
              }
              console.log('Sitemap created.')
            }
          )
      });
    }
  })
})
