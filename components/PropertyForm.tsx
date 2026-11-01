"use client";
import { useFormState } from "react-dom";
import { createProperty, updateProperty, type FormState } from "@/app/sites/[tenant]/actions";

type D = Record<string, any>;
const paise = (v: number | null | undefined) => (v == null ? "" : String(v / 100));
export default function PropertyForm({ property }: { property?: D }) {
  const edit = !!property;
  const [state, action] = useFormState<FormState, FormData>(edit ? updateProperty : createProperty, null);
  const d = property ?? {};
  return (
    <form action={action}>
      {edit && <input type="hidden" name="id" value={d.id} />}
      <fieldset style={{border:0,padding:0}}><legend><h2>Basic information</h2></legend>
        <label htmlFor="title">Property title</label><input id="title" name="title" required minLength={5} defaultValue={d.title} placeholder="3 BHK apartment in Sector 74" />
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div><label htmlFor="listing_type">Sale or rent</label><select id="listing_type" name="listing_type" defaultValue={d.listing_type ?? "sale"}><option value="sale">Sale</option><option value="rent">Rent</option></select></div>
          <div><label htmlFor="category">Type</label><select id="category" name="category" defaultValue={d.category ?? "apartment"}><option value="apartment">Apartment</option><option value="house">House</option><option value="plot">Plot</option><option value="commercial">Commercial</option></select></div>
          <div><label htmlFor="price">Price (₹)</label><input id="price" name="price" type="number" min={0} step="1" defaultValue={paise(d.price_minor)} /></div>
          <div><label htmlFor="construction_status">Construction status</label><select id="construction_status" name="construction_status" defaultValue={d.construction_status ?? "ready_to_move"}><option value="ready_to_move">Ready to move</option><option value="under_construction">Under construction</option></select></div>
        </div>
        <label htmlFor="description">Description</label><textarea id="description" name="description" defaultValue={d.description ?? ""} />
      </fieldset>
      <fieldset style={{border:0,padding:0}}><legend><h2 style={{marginTop:24}}>Location</h2></legend>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
          <div><label htmlFor="locality">Locality</label><input id="locality" name="locality" defaultValue={d.locality ?? ""} /></div>
          <div><label htmlFor="city">City</label><input id="city" name="city" defaultValue={d.city ?? ""} /></div>
          <div><label htmlFor="state">State</label><input id="state" name="state" defaultValue={d.state ?? ""} /></div>
        </div>
      </fieldset>
      <fieldset style={{border:0,padding:0}}><legend><h2 style={{marginTop:24}}>Specifications</h2></legend>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
          <div><label htmlFor="bedrooms">BHK</label><input id="bedrooms" name="bedrooms" type="number" min={0} defaultValue={d.bedrooms ?? ""} /></div>
          <div><label htmlFor="bathrooms">Baths</label><input id="bathrooms" name="bathrooms" type="number" min={0} defaultValue={d.bathrooms ?? ""} /></div>
          <div><label htmlFor="builtup_area">Built-up (sq ft)</label><input id="builtup_area" name="builtup_area" type="number" min={0} defaultValue={d.builtup_area ?? ""} /></div>
          <div><label htmlFor="furnishing">Furnishing</label><select id="furnishing" name="furnishing" defaultValue={d.furnishing ?? ""}><option value="">-</option><option value="unfurnished">Unfurnished</option><option value="semi">Semi furnished</option><option value="furnished">Furnished</option></select></div>
        </div>
      </fieldset>
      {state?.error && <div className="msg err" role="alert">{state.error}</div>}
      {state?.ok && <div className="msg ok" role="status">{state.ok}</div>}
      <p style={{display:"flex",gap:12}}>
        {edit ? <>
          <button className="btn ghost" type="submit" name="intent" value="save">Save changes</button>
          <button className="btn gold" type="submit" name="intent" value="publish">Publish</button>
        </> : <button className="btn" type="submit">Save and add photos</button>}
      </p>
    </form>
  );
}
