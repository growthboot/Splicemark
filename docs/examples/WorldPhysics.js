const EPSILON = 1e-8;
const PARALLEL_EPSILON = 1e-10;
const DEFAULT_GRAVITY = Object.freeze({
	x: 0,
	y: -9.81,
	z: 0
});
function finite(value, name) {
	if (!Number.isFinite(value)) {
		throw new TypeError(name + ' must be a finite number');
	}
	return value;
}
function positive(value, name) {
	finite(value, name);
	if (value <= 0) {
		throw new RangeError(name + ' must be greater than zero');
	}
	return value;
}
export function clamp(value, min, max) {
	if (min > max) {
		throw new RangeError('clamp min cannot exceed max');
	}
	return Math.min(max, Math.max(min, value));
}
export function lerp(a, b, t) {
	return a + (b - a) * t;
}
export function inverseLerp(a, b, value) {
	const span = b - a;
	if (Math.abs(span) <= EPSILON) {
		return 0;
	}
	return (value - a) / span;
}
export function nearlyEqual(a, b, epsilon = EPSILON) {
	return Math.abs(a - b) <= epsilon;
}
export class Vec3 {
	constructor(x = 0, y = 0, z = 0) {
		this.x = finite(x, 'x');
		this.y = finite(y, 'y');
		this.z = finite(z, 'z');
	}
	static zero() {
		return new Vec3(0, 0, 0);
	}
	static one() {
		return new Vec3(1, 1, 1);
	}
	static up() {
		return new Vec3(0, 1, 0);
	}
	static from(value) {
		if (value instanceof Vec3) {
			return value.clone();
		}
		return new Vec3(
			value?.x ?? 0,
			value?.y ?? 0,
			value?.z ?? 0
		);
	}
	clone() {
		return new Vec3(this.x, this.y, this.z);
	}
	set(x, y, z) {
		this.x = finite(x, 'x');
		this.y = finite(y, 'y');
		this.z = finite(z, 'z');
		return this;
	}
	copy(other) {
		return this.set(
			other.x,
			other.y,
			other.z
		);
	}
	add(other) {
		this.x += other.x;
		this.y += other.y;
		this.z += other.z;
		return this;
	}
	sub(other) {
		this.x -= other.x;
		this.y -= other.y;
		this.z -= other.z;
		return this;
	}
	scale(value) {
		finite(value, 'scale');
		this.x *= value;
		this.y *= value;
		this.z *= value;
		return this;
	}
	addScaled(other, scale) {
		finite(scale, 'scale');
		this.x += other.x * scale;
		this.y += other.y * scale;
		this.z += other.z * scale;
		return this;
	}
	multiply(other) {
		this.x *= other.x;
		this.y *= other.y;
		this.z *= other.z;
		return this;
	}
	divide(other) {
		if (
			Math.abs(other.x) <= EPSILON ||
			Math.abs(other.y) <= EPSILON ||
			Math.abs(other.z) <= EPSILON
		) {
			throw new RangeError('cannot divide Vec3 by a near-zero component');
		}
		this.x /= other.x;
		this.y /= other.y;
		this.z /= other.z;
		return this;
	}
	dot(other) {
		return (this.x * other.x + this.y * other.y + this.z * other.z);
	}
	cross(other) {
		const x = this.y * other.z - this.z * other.y;
		const y = this.z * other.x - this.x * other.z;
		const z = this.x * other.y - this.y * other.x;
		return this.set(x, y, z);
	}
	lengthSquared() {
		return this.dot(this);
	}
	length() {
		return Math.sqrt(this.lengthSquared());
	}
	normalize() {
		const length = this.length();
		if (length <= EPSILON) {
			return this.set(0, 0, 0);
		}
		return this.scale(1 / length);
	}
	distanceSquared(other) {
		const dx = this.x - other.x;
		const dy = this.y - other.y;
		const dz = this.z - other.z;
		return dx * dx + dy * dy + dz * dz;
	}
	distance(other) {
		return Math.sqrt(this.distanceSquared(other));
	}
	lerp(other, t) {
		this.x = lerp(this.x, other.x, t);
		this.y = lerp(this.y, other.y, t);
		this.z = lerp(this.z, other.z, t);
		return this;
	}
	min(other) {
		this.x = Math.min(this.x, other.x);
		this.y = Math.min(this.y, other.y);
		this.z = Math.min(this.z, other.z);
		return this;
	}
	max(other) {
		this.x = Math.max(this.x, other.x);
		this.y = Math.max(this.y, other.y);
		this.z = Math.max(this.z, other.z);
		return this;
	}
	projectOn(other) {
		const denominator = other.lengthSquared();
		if (denominator <= EPSILON) {
			return this.set(0, 0, 0);
		}
		const scale = this.dot(other) / denominator;
		return this.copy(other).scale(scale);
	}
	projectOnPlane(normal) {
		const projection = normal.clone().scale(this.dot(normal));
		return this.sub(projection);
	}
	reflect(normal) {
		const scale = 2 * this.dot(normal);
		return this.addScaled(normal, -scale);
	}
	clampLength(maxLength) {
		positive(maxLength, 'maxLength');
		const lengthSquared = this.lengthSquared();
		const maxSquared = maxLength * maxLength;
		if (lengthSquared > maxSquared) {
			this.scale(
				maxLength /
				Math.sqrt(lengthSquared)
			);
		}
		return this;
	}
	toArray(target = [], offset = 0) {
		target[offset] = this.x;
		target[offset + 1] = this.y;
		target[offset + 2] = this.z;
		return target;
	}
	toJSON() {
		return {
			x: this.x,
			y: this.y,
			z: this.z
		};
	}
}
export class Aabb {
	constructor(min = Vec3.zero(), max = Vec3.zero()) {
		this.min = Vec3.from(min);
		this.max = Vec3.from(max);
		this.#validate();
	}
	static fromCenterExtents(center, extents) {
		const c = Vec3.from(center);
		const e = Vec3.from(extents);
		return new Aabb(
			c.clone().sub(e),
			c.clone().add(e)
		);
	}
	static fromPoints(points) {
		if (!points.length) {
			throw new RangeError('Aabb.fromPoints requires at least one point');
		}
		const min = Vec3.from(points[0]);
		const max = Vec3.from(points[0]);
		for (let index = 1; index < points.length; index++) {
			min.min(points[index]);
			max.max(points[index]);
		}
		return new Aabb(min, max);
	}
	clone() {
		return new Aabb(
			this.min,
			this.max
		);
	}
	center(target = new Vec3()) {
		return target
			.copy(this.min)
			.add(this.max)
			.scale(0.5);
	}
	extents(target = new Vec3()) {
		return target
			.copy(this.max)
			.sub(this.min)
			.scale(0.5);
	}
	size(target = new Vec3()) {
		return target
			.copy(this.max)
			.sub(this.min);
	}
	expand(amount) {
		if (amount instanceof Vec3) {
			this.min.sub(amount);
			this.max.add(amount);
		} else {
			positive(amount, 'amount');
			const delta = new Vec3(amount, amount, amount);
			this.min.sub(delta);
			this.max.add(delta);
		}
		return this;
	}
	translated(offset) {
		return new Aabb(
			this.min.clone().add(offset),
			this.max.clone().add(offset)
		);
	}
	containsPoint(point) {
		return (
			point.x >= this.min.x &&
			point.x <= this.max.x &&
			point.y >= this.min.y &&
			point.y <= this.max.y &&
			point.z >= this.min.z &&
			point.z <= this.max.z
		);
	}
	intersects(other) {
		return !(
			this.max.x < other.min.x ||
			this.min.x > other.max.x ||
			this.max.y < other.min.y ||
			this.min.y > other.max.y ||
			this.max.z < other.min.z ||
			this.min.z > other.max.z
		);
	}
	closestPoint(point, target = new Vec3()) {
		return target.set(
			clamp(point.x, this.min.x, this.max.x),
			clamp(point.y, this.min.y, this.max.y),
			clamp(point.z, this.min.z, this.max.z)
		);
	}
	distanceSquaredToPoint(point) {
		const closest = this.closestPoint(point);
		return closest.distanceSquared(point);
	}
	surfaceArea() {
		const size = this.size();
		return 2 * (
			size.x * size.y +
			size.y * size.z +
			size.z * size.x
		);
	}
	#validate() {
		if (
			this.min.x > this.max.x ||
			this.min.y > this.max.y ||
			this.min.z > this.max.z
		) {
			throw new RangeError('Aabb min must not exceed max');
		}
	}
}
export function intersectRayAabb(origin, direction, aabb, maxDistance = Infinity) {
	let near = 0;
	let far = maxDistance;
	let normal = Vec3.zero();
	for (const axis of ['x', 'y', 'z']) {
		const o = origin[axis];
		const d = direction[axis];
		const min = aabb.min[axis];
		const max = aabb.max[axis];
		if (Math.abs(d) <= PARALLEL_EPSILON) {
			if (o < min || o > max) {
				return null;
			}
			continue;
		}
		const inverse = 1 / d;
		let t1 = (min - o) * inverse;
		let t2 = (max - o) * inverse;
		let sign = -Math.sign(d);
		if (t1 > t2) {
			[t1, t2] = [t2, t1];
			sign = -sign;
		}
		if (t1 > near) {
			near = t1;
			normal = Vec3.zero();
			normal[axis] = sign;
		}
		far = Math.min(far, t2);
		if (near > far) {
			return null;
		}
	}
	if (far < 0) {
		return null;
	}
	const distance = Math.max(near, 0);
	return {
		distance,
		point:
			origin.clone().addScaled(
				direction,
				distance
			),
		normal
	};
}
export function sweepSphereAabb(center, radius, delta, aabb) {
	const expanded = aabb.clone().expand(radius);
	const distance = delta.length();
	if (distance <= EPSILON) {
		return expanded.containsPoint(center)
			? {
				time: 0,
				distance: 0,
				point: center.clone(),
				normal: Vec3.zero()
			}
			: null;
	}
	const direction = delta.clone().scale(1 / distance);
	const hit = intersectRayAabb(center, direction, expanded, distance);
	if (!hit) {
		return null;
	}
	return {
		time:
			clamp(hit.distance / distance, 0, 1),
		distance: hit.distance,
		point: hit.point,
		normal: hit.normal
	};
}
function cellKey(x, y, z) {
	return x + ':' + y + ':' + z;
}
export class SpatialHash3D {
	#cells = new Map();
	#entries = new Map();
	constructor(cellSize = 4) {
		this.cellSize =
			positive(cellSize, 'cellSize');
		this.inverseCellSize =
			1 / this.cellSize;
	}
	clear() {
		this.#cells.clear();
		this.#entries.clear();
	}
	insert(id, bounds, value = id) {
		if (this.#entries.has(id)) {
			throw new Error('duplicate spatial id: ' + id);
		}
		const entry = {
			id,
			value,
			bounds: bounds.clone(),
			keys: this.#keysFor(bounds)
		};
		this.#entries.set(id, entry);
		for (const key of entry.keys) {
			let bucket = this.#cells.get(key);
			if (!bucket) {
				bucket = new Set();
				this.#cells.set(key, bucket);
			}
			bucket.add(id);
		}
		return entry;
	}
	update(id, bounds) {
		const current = this.#entries.get(id);
		if (!current) {
			throw new Error('unknown spatial id: ' + id);
		}
		const nextKeys = this.#keysFor(bounds);
		const nextSet = new Set(nextKeys);
		const currentSet = new Set(current.keys);
		for (const key of current.keys) {
			if (!nextSet.has(key)) {
				const bucket = this.#cells.get(key);
				bucket?.delete(id);
				if (bucket?.size === 0) {
					this.#cells.delete(key);
				}
			}
		}
		for (const key of nextKeys) {
			if (!currentSet.has(key)) {
				let bucket = this.#cells.get(key);
				if (!bucket) {
					bucket = new Set();
					this.#cells.set(key, bucket);
				}
				bucket.add(id);
			}
		}
		current.bounds = bounds.clone();
		current.keys = nextKeys;
		return current;
	}
	remove(id) {
		const entry = this.#entries.get(id);
		if (!entry) {
			return false;
		}
		for (const key of entry.keys) {
			const bucket = this.#cells.get(key);
			bucket?.delete(id);
			if (bucket?.size === 0) {
				this.#cells.delete(key);
			}
		}
		this.#entries.delete(id);
		return true;
	}
	queryAabb(bounds, predicate = null) {
		const ids = new Set();
		for (const key of this.#keysFor(bounds)) {
			const bucket = this.#cells.get(key);
			if (!bucket) {
				continue;
			}
			for (const id of bucket) {
				ids.add(id);
			}
		}
		const results = [];
		for (const id of ids) {
			const entry = this.#entries.get(id);
			if (!entry?.bounds.intersects(bounds)) {
				continue;
			}
			if (predicate && !predicate(entry.value, entry)) {
				continue;
			}
			results.push(entry.value);
		}
		return results;
	}
	querySphere(sphere, predicate = null) {
		const radius = new Vec3(sphere.radius, sphere.radius, sphere.radius);
		const bounds = new Aabb(sphere.center.clone().sub(radius), sphere.center.clone().add(radius));
		return this.queryAabb(
			bounds,
			(value, entry) =>
				sphere.intersectsAabb(entry.bounds) &&
				(!predicate || predicate(value, entry))
		);
	}
	#keysFor(bounds) {
		const minX = Math.floor(bounds.min.x * this.inverseCellSize);
		const minY = Math.floor(bounds.min.y * this.inverseCellSize);
		const minZ = Math.floor(bounds.min.z * this.inverseCellSize);
		const maxX = Math.floor(bounds.max.x * this.inverseCellSize);
		const maxY = Math.floor(bounds.max.y * this.inverseCellSize);
		const maxZ = Math.floor(bounds.max.z * this.inverseCellSize);
		const keys = [];
		for (let x = minX; x <= maxX; x++) {
			for (let y = minY; y <= maxY; y++) {
				for (let z = minZ; z <= maxZ; z++) {
					keys.push(
						cellKey(x, y, z)
					);
				}
			}
		}
		return keys;
	}
}
export function solveInterceptTime({
	shooterPosition,
	targetPosition,
	targetVelocity,
	projectileSpeed,
	maxTime = 10
}) {
	positive(projectileSpeed, 'projectileSpeed');
	positive(maxTime, 'maxTime');
	const displacement = Vec3.from(targetPosition)
		.sub(shooterPosition);
	const velocity = Vec3.from(targetVelocity);
	const speedSquared = projectileSpeed * projectileSpeed;
	const a = velocity.lengthSquared() - speedSquared;
	const b = 2 * displacement.dot(velocity);
	const c = displacement.lengthSquared();
	if (c <= EPSILON) {
		return 0;
	}
	if (Math.abs(a) <= EPSILON) {
		if (Math.abs(b) <= EPSILON) {
			return null;
		}
		const linearTime = -c / b;
		return (
			linearTime > 0 &&
			linearTime <= maxTime
		)
			? linearTime
			: null;
	}
	const discriminant = b * b - 4 * a * c;
	if (discriminant < 0) {
		return null;
	}
	const root = Math.sqrt(discriminant);
	const denominator = 2 * a;
	const first = (-b - root) / denominator;
	const second = (-b + root) / denominator;
	const candidates = [first, second]
		.filter(time => time > 0 && time <= maxTime)
		.sort((left, right) => left - right);
	return candidates[0] ?? null;
}
export function predictInterceptPoint(options) {
	const time = solveInterceptTime(options);
	if (time === null) {
		return null;
	}
	return Vec3.from(options.targetPosition)
		.addScaled(
			options.targetVelocity,
			time
		);
}
export function integrateBallistic({
	position,
	velocity,
	deltaTime,
	gravity = DEFAULT_GRAVITY,
	linearDrag = 0
}) {
	positive(deltaTime, 'deltaTime');
	const drag = Math.max(0, linearDrag);
	const nextVelocity = Vec3.from(velocity)
		.addScaled(gravity, deltaTime);
	if (drag > 0) {
		nextVelocity.scale(
			Math.exp(
				-drag * deltaTime
			)
		);
	}
	const nextPosition = Vec3.from(position)
		.addScaled(nextVelocity, deltaTime);
	return {
		position: nextPosition,
		velocity: nextVelocity
	};
}
export function moveKinematicBody({
	position,
	velocity,
	deltaTime,
	radius,
	candidates,
	maxIterations = 4
}) {
	positive(deltaTime, 'deltaTime');
	positive(radius, 'radius');
	let currentPosition = Vec3.from(position);
	let remaining = Vec3.from(velocity)
		.scale(deltaTime);
	const contacts = [];
	for (
		let iteration = 0;
		iteration < maxIterations;
		iteration++
	) {
		if (remaining.lengthSquared() <= EPSILON) {
			break;
		}
		let earliest = null;
		for (const candidate of candidates) {
			const hit = sweepSphereAabb(currentPosition, radius, remaining, candidate.bounds);
			if (
				!hit ||
				(
					earliest &&
					hit.time >= earliest.hit.time
				)
			) {
				continue;
			}
			earliest = {
				hit,
				candidate
			};
		}
		if (!earliest) {
			currentPosition.add(remaining);
			remaining.set(0, 0, 0);
			break;
		}
		const travel = Math.max(0, earliest.hit.time - 1e-4);
		currentPosition.addScaled(
			remaining,
			travel
		);
		contacts.push({
			normal:
				earliest.hit.normal.clone(),
			collider:
				earliest.candidate
		});
		remaining.scale(
			1 - travel
		);
		remaining.projectOnPlane(
			earliest.hit.normal
		);
	}
	return {
		position: currentPosition,
		velocity:
			remaining
				.clone()
				.scale(1 / deltaTime),
		contacts
	};
}
export function chooseGroundContact(contacts, up = Vec3.up(), minGroundDot = 0.65) {
	let best = null;
	let bestDot = minGroundDot;
	for (const contact of contacts) {
		const dot = contact.normal.dot(up);
		if (dot > bestDot) {
			bestDot = dot;
			best = contact;
		}
	}
	return best;
}
export function resolveCharacterVelocity({
	velocity,
	wishDirection,
	acceleration,
	maxSpeed,
	deltaTime,
	groundNormal = null
}) {
	positive(acceleration, 'acceleration');
	positive(maxSpeed, 'maxSpeed');
	positive(deltaTime, 'deltaTime');
	const desired = Vec3.from(wishDirection);
	if (groundNormal) {
		desired.projectOnPlane(
			groundNormal
		);
	}
	if (desired.lengthSquared() > EPSILON) {
		desired
			.normalize()
			.scale(maxSpeed);
	}
	const change = desired
		.sub(velocity)
		.clampLength(acceleration * deltaTime);
	return Vec3.from(velocity)
		.add(change);
}
export default {
	Aabb,
	SpatialHash3D,
	Vec3,
	clamp,
	integrateBallistic,
	intersectRayAabb,
	inverseLerp,
	lerp,
	moveKinematicBody,
	nearlyEqual,
	predictInterceptPoint,
	resolveCharacterVelocity,
	solveInterceptTime,
	sweepSphereAabb
};
