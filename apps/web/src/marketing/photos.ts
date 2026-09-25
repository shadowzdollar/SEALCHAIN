/** Trade photographs (Wikimedia Commons), resized and recompressed for the web. */

export interface Photo {
  src: string;
  sm: string;
  alt: string;
  place: string;
  author: string;
  license: string;
  licenseUrl: string;
  source: string;
}

const p = (key: string, alt: string, place: string, author: string, license: string, licenseUrl: string, source: string): Photo => ({
  src: `/images/trade/${key}.jpg`,
  sm: `/images/trade/${key}-sm.jpg`,
  alt, place, author, license, licenseUrl, source,
});

export const PHOTOS = {
  portCranes: p("port-cranes", "Ship-to-shore cranes and container stacks at the Port of Mombasa, Kenya", "Mombasa, Kenya", "Kenya Ministry of East African Affairs, Commerce & Tourism", "Public domain", "", "https://commons.wikimedia.org/wiki/File:2015_07_31_Mombasa_Port_JPEG_RESIZED_0033.jpg"),
  portTruck: p("port-truck", "A dock worker walks past a truck loaded with containers at the Port of Mombasa", "Mombasa, Kenya", "Kenya Ministry of East African Affairs, Commerce & Tourism", "Public domain", "", "https://commons.wikimedia.org/wiki/File:2015_07_31_Mombasa_Port_JPEG_RESIZED_0042.jpg"),
  containerStacks: p("container-stacks", "Rows of stacked shipping containers at the Port of Mombasa", "Mombasa, Kenya", "Kenya Ministry of East African Affairs, Commerce & Tourism", "Public domain", "", "https://commons.wikimedia.org/wiki/File:2015_07_31_Mombasa_Port_JPEG_RESIZED_0044.jpg"),
  shipMombasa: p("ship-mombasa", "A container ship leaving the Port of Mombasa, watched from the shore", "Mombasa, Kenya", "Ian Kiptoo", "CC BY 4.0", "https://creativecommons.org/licenses/by/4.0", "https://commons.wikimedia.org/wiki/File:Container_ship_exiting_Mombasa_port,_Kenya_01.jpg"),
  darHarbour: p("dar-harbour", "Ships and cranes in the harbour at Dar es Salaam, Tanzania", "Dar es Salaam, Tanzania", "Sarvesh Lutchmun", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", "https://commons.wikimedia.org/wiki/File:Dar_Es_Salaam_port_activities_in_Tanzania.jpg"),
  truckNileBridge: p("truck-nile-bridge", "A truck crossing the Albert Nile bridge in northern Uganda", "Northern Uganda", "Jim Joel", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", "https://commons.wikimedia.org/wiki/File:A_track_and_pedestrians_cross_the_Albert_Nile_bridge_in_Northern_Uganda.jpg"),
  teaPicker: p("tea-picker", "A tea picker with a basket harvesting leaves on a plantation", "", "Rogerirakoze", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0", "https://commons.wikimedia.org/wiki/File:Tea_harvesting_261224.jpg"),
  teaFields: p("tea-fields", "Mountain tea plantation in Nyabihu District, Western Rwanda", "Nyabihu, Rwanda", "Synkubito", "CC0", "http://creativecommons.org/publicdomain/zero/1.0/deed.en", "https://commons.wikimedia.org/wiki/File:Tea_plantation,_Western_Rwanda.jpg"),
  kigaliAirport: p("kigali-airport", "The entrance sign of Kigali International Airport, Rwanda", "Kigali, Rwanda", "Dave Proffer", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", "https://commons.wikimedia.org/wiki/File:Kigali_airport_-_Flickr_-_Dave_Proffer.jpg"),
  freighter: p("freighter", "A Boeing 747-8F freighter with its nose cargo door raised", "", "Olivier Cleynen", "CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0", "https://commons.wikimedia.org/wiki/File:Nose_cargo_door_of_Boeing_747-8F.jpg"),
  kigaliSkyline: p("kigali-skyline", "The skyline of central Kigali at dusk", "Kigali, Rwanda", "Adrien K", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0", "https://commons.wikimedia.org/wiki/File:Kigali2018Cropped.jpg"),
  craneSilhouette: p("crane-silhouette", "A container crane silhouetted against a clear sky", "", "Bernard Spragg", "CC0", "http://creativecommons.org/publicdomain/zero/1.0/deed.en", "https://commons.wikimedia.org/wiki/File:Container_Crane_Lyttelton._(12807777564).jpg"),
} as const;

export type PhotoKey = keyof typeof PHOTOS;
