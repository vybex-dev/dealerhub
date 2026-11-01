"use client";
import { useFormState } from "react-dom";
import { createProperty, type FormState } from "@/app/sites/[tenant]/actions";
export default function PropertyForm() {
  const [state, action] = useFormState<FormState, FormData>(createProperty, null);
  return (
    <form action={action}>
      <fieldset style={{border:0,padding:0}}><legend><h2>Basic information</h2></legend>
        <label htmlFor="title">Property title</label><input id="title" name="title" required minLength={5} placeholder="3 BHK apartment in Sector 74" />
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div><label htmlFor="listing_type">Sale or rent</label><select id="listing_type" name="listing_type"><option value="sale">Sale</option><option value="rent">Rent</option></select></div>
          <div><label htmlFor="category">Type</label><select id="category" name="category"><option value="apartment">Apartment</option><option value="house">House</option><option value="plot">Plot</option><option value="commercial">Commercial</option></select></div>
          <div><label htmlFor="price">Price (₹)</label><input id="price" name="price" type="number" min={0} step="1" /></div>
          <div><label htmlFor="construction_status">Construction status</label><select id="construction_status" name="construction_status"><option value="ready_to_move">Ready to move</option><option value="under_construction">Under construction</option></select></div>
        </div>
        <label htmlFor="description">Description</label><textarea id="description" name="description" />
      </fieldset>
      <fieldset style={{border:0,padding:0}}><legend><h2 style={{marginTop:24}}>Location</h2></legend>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
          <div><label htmlFor="locality">Locality</label><input id="locality" name="locality" /></div>
          <div><label htmlFor="city">City</label><input id="city" name="city" /></div>
          <div><label htmlFor="state">State</label><input id="state" name="state" /></div>
        </div>
      </fieldset>
      <fieldset style={{border:0,padding:0}}><legend><h2 style={{marginTop:24}}>Specifications</h2></legend>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
          <div><label htmlFor="bedrooms">BHK</label><input id="bedrooms" name="bedrooms" type="number" min={0} /></div>
          <div><label htmlFor="bathrooms">Baths</label><input id="bathrooms" name="bathrooms" type="number" min={0} /></div>
          <div><label htmlFor="builtup_area">Built-up (sq ft)</label><input id="builtup_area" name="builtup_area" type="number" min={0} /></div>
          <div><label htmlFor="furnishing">Furnishing</label><select id="furnishing" name="furnishing"><option value="">-</option><option value="unfurnished">Unfurnished</option><option value="semi">Semi furnished</option><option value="furnished">Furnished</option></select></div>
        </div>
      </fieldset>
      {state?.error && <div className="msg err" role="alert">{state.error}</div>}
      <p style={{display:"flex",gap:12}}>
        <button className="btn ghost" type="submit" name="intent" value="draft">Save draft</button>
        <button className="btn gold" type="submit" name="intent" value="publish">Publish</button>
      </p>
    </form>
  );
}
