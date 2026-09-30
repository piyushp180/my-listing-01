# Etsy Listing Builder (Firebase + Cloudinary + GitHub Pages) - no Blaze plan

Text lives in Firebase (free Spark plan). Photos live in Cloudinary (free plan), uploaded as original files.

## 1. Firebase (free Spark plan)
1. console.firebase.google.com -> Add project.
2. Authentication -> Get started -> enable Email/Password. Users tab -> Add user twice (Piyush, didi).
3. Firestore Database -> Create database (production mode, asia-south1).
4. Project settings -> Your apps -> Web app -> copy config into `firebase-config.js` (firebaseConfig block).
5. Put both emails in `firestore.rules`, paste into Firestore -> Rules tab, Publish.
Do NOT enable Storage.

## 2. Cloudinary (free)
1. cloudinary.com -> sign up for the Free plan.
2. Settings (gear) -> Upload -> Upload presets -> Add upload preset: **Signing mode = Unsigned**, name it e.g. `etsy_unsigned`. Do not add any transformations or incoming size limits. Save.
3. Copy your Cloud name (dashboard top-left) and the preset name into `cloudinary` block in `firebase-config.js`.
4. Settings -> Account -> Usage limits: check the max image file size / megapixels (free plan was about 10 MB and 25 MP when last checked).

## 3. GitHub Pages
1. New repo, upload all files here. Settings -> Pages -> Deploy from branch -> main / root.
2. Firebase -> Authentication -> Settings -> Authorized domains -> add `YOURNAME.github.io`.
3. Open the link, sign in, make a listing, upload a photo.

## Notes
- Keys in firebase-config.js are not secrets; Firestore rules limit data to the two emails.
- The Cloudinary unsigned preset means anyone who reads the config could upload into your Cloudinary. Keep the repo private if you can (Pages on private repos needs a paid GitHub plan), or just watch the Cloudinary dashboard. Delete the preset if you ever see junk uploads.
- Removing a photo in the app removes it from the listing only. To free Cloudinary space, delete it in the Cloudinary Media Library.
