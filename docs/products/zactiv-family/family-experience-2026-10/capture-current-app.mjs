/** Read-only visual inspection of current source using fictional Directus responses. */
import { chromium } from '@playwright/test'
import { fileURLToPath } from 'node:url'
const root=fileURLToPath(new URL('.',import.meta.url))
const browser=await chromium.launch({headless:true})
try {
  const page=await browser.newPage({viewport:{width:390,height:844}})
  let signedIn=false
  const user={id:'design-fixture-user',email:'parent@example.test',first_name:'Alex',family_name:'Example family',zactivs_balance:50}
  const workout={id:7,name:'Burpee Burnout Challenge',short_description:'Move together.',time:'30 min',image:null,warm_up:'<p>Gentle squats</p>',main_workout:'<ul><li>15 burpees</li><li>20 squats</li></ul>',zactivs:10,status:'published',tags:[]}
  const recipe={id:3,name:'Coconut & Butterbean Noodles',short_description:'Creamy and ready in 20 minutes.',time_prep:10,time_cook:10,servings_adults_base:2,ingredients:'<ul><li>250 g noodles</li></ul>',instructions:'<ol><li>Soften the garlic.</li></ol>',status:'published',tags:[]}
  await page.route('http://localhost:8055/**',async route=>{
    const path=new URL(route.request().url()).pathname
    let data=[];let status=200
    if(path==='/auth/login'){signedIn=true;data={access_token:'fixture-token',refresh_token:'fixture-refresh',expires:900000}}
    else if(path==='/auth/refresh'){status=signedIn?200:401;data=signedIn?{access_token:'fixture-token',refresh_token:'fixture-refresh',expires:900000}:null}
    else if(path==='/users/me'){status=signedIn?200:401;data=signedIn?user:null}
    else if(path.startsWith('/items/workouts'))data=path.endsWith('/7')?workout:[workout]
    else if(path.startsWith('/items/recipes'))data=path.endsWith('/3')?recipe:[recipe]
    else if(path.startsWith('/items/logs'))data=[]
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(status===401?{errors:[{message:'Not signed in',extensions:{code:'TOKEN_EXPIRED'}}]}:{data})})
  })
  await page.goto('http://127.0.0.1:5179/login')
  await page.getByLabel('Email').fill('parent@example.test')
  await page.getByLabel('Password',{exact:true}).fill('fictional-password')
  await page.getByRole('button',{name:'Sign in',exact:true}).click()
  await page.getByRole('button',{name:'Start',exact:true}).click()
  await page.getByRole('heading',{name:/together/}).waitFor()
  await page.screenshot({path:root+'assets/current-home-fixture.png',fullPage:true})
  await page.getByRole('navigation',{name:'Primary'}).getByRole('link',{name:'Journal',exact:true}).click()
  await page.getByRole('heading',{name:'Today’s after-school chat'}).waitFor()
  await page.screenshot({path:root+'assets/current-journal-fixture.png',fullPage:true})
  await page.getByRole('button',{name:'Your family',exact:true}).click()
  await page.getByRole('heading',{name:'Example family',exact:true}).waitFor()
  await page.screenshot({path:root+'assets/current-family-fixture.png',fullPage:true})
  console.log('Rendered current home, journal and family screens with fictional API fixtures. No production backend was contacted.')
} finally { await browser.close() }
